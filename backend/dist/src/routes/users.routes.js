"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
const bot_js_1 = require("../bot.js");
const client_1 = require("@prisma/client");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.get('/', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const { search = '' } = req.query;
    const where = {};
    if (search) {
        const s = String(search);
        if (/^\d+$/.test(s))
            where.telegramId = BigInt(s);
        else
            where.OR = [{ username: { contains: s, mode: 'insensitive' } }, { firstName: { contains: s, mode: 'insensitive' } }];
    }
    const [total, items] = await Promise.all([
        db_js_1.prisma.user.count({ where }),
        db_js_1.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize }),
    ]);
    res.json({ total, items: items.map((u) => ({ ...u, telegramId: u.telegramId.toString(), referredByUserId: u.referredByUserId?.toString() ?? null })) });
});
exports.usersRouter.get('/:telegramId', auth_js_1.requireAuth, async (req, res) => {
    const tid = BigInt(req.params.telegramId);
    const user = await db_js_1.prisma.user.findUnique({ where: { telegramId: tid }, include: { orders: { orderBy: { createdAt: 'desc' }, take: 20, include: { product: true } }, walletTxns: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!user)
        return res.status(404).json({ error: 'not found' });
    const referrals = await db_js_1.prisma.user.findMany({ where: { referredByUserId: tid } });
    const totalSpent = await db_js_1.prisma.order.aggregate({ where: { userId: tid, paymentStatus: 'PAID' }, _sum: { amountUsdt: true } });
    res.json({
        ...user, telegramId: user.telegramId.toString(), referredByUserId: user.referredByUserId?.toString() ?? null,
        orders: user.orders, walletTxns: user.walletTxns.map((t) => ({ ...t, userId: t.userId.toString() })),
        referrals: referrals.map((r) => ({ ...r, telegramId: r.telegramId.toString() })),
        totalSpent: Number(totalSpent._sum.amountUsdt ?? 0),
    });
});
exports.usersRouter.post('/:telegramId/adjust', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.adjustDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const adminId = req.adminId;
    const tid = BigInt(req.params.telegramId);
    const deltaDec = new client_1.Prisma.Decimal(p.data.delta);
    try {
        const result = await db_js_1.prisma.$transaction(async (tx) => {
            const current = await tx.user.findUnique({ where: { telegramId: tid } });
            if (!current)
                return null;
            const next = new client_1.Prisma.Decimal(current.walletBalance).plus(deltaDec);
            if (next.isNegative())
                throw new Error('insufficient balance');
            const u = await tx.user.update({
                where: { telegramId: tid },
                data: { walletBalance: { increment: deltaDec } },
                select: { walletBalance: true },
            });
            await tx.walletTransaction.create({
                data: {
                    userId: tid,
                    type: 'ADMIN_ADJUST',
                    amount: deltaDec,
                    balanceAfter: u.walletBalance,
                    note: p.data.reason,
                    adminId,
                },
            });
            return { before: current.walletBalance, after: u.walletBalance };
        });
        if (!result)
            return res.status(404).json({ error: 'not found' });
        await (0, auth_js_1.audit)(adminId, 'wallet:adjust', 'user', String(tid), { balance: String(result.before) }, { balance: result.after.toString(), delta: p.data.delta, reason: p.data.reason }, req.ip ?? '');
        await (0, bot_js_1.sendUserMessage)(String(tid), `💳 Wallet adjusted: ${p.data.delta > 0 ? '+' : ''}$${p.data.delta.toFixed(2)}. Reason: ${p.data.reason}`);
        res.json({ ok: true, balance: result.after.toString() });
    }
    catch (err) {
        if (err instanceof Error && err.message === 'insufficient balance') {
            return res.status(400).json({ error: 'insufficient balance' });
        }
        throw err;
    }
});
exports.usersRouter.post('/:telegramId/ban', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const adminId = req.adminId;
    const tid = BigInt(req.params.telegramId);
    const { banned } = req.body;
    const before = await db_js_1.prisma.user.findUnique({ where: { telegramId: tid } });
    const u = await db_js_1.prisma.user.update({ where: { telegramId: tid }, data: { status: banned ? 'BANNED' : 'ACTIVE' } });
    await (0, auth_js_1.audit)(adminId, banned ? 'user:ban' : 'user:unban', 'user', String(tid), before?.status, u.status, req.ip ?? '');
    res.json({ ok: true, status: u.status });
});
exports.usersRouter.post('/:telegramId/reset-ref', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const adminId = req.adminId;
    const tid = BigInt(req.params.telegramId);
    const code = `TZ${String(tid).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
    const before = await db_js_1.prisma.user.findUnique({ where: { telegramId: tid } });
    const u = await db_js_1.prisma.user.update({ where: { telegramId: tid }, data: { referralCode: code } });
    await (0, auth_js_1.audit)(adminId, 'user:reset-ref', 'user', String(tid), before?.referralCode, code, req.ip ?? '');
    res.json({ ok: true, referralCode: u.referralCode });
});
