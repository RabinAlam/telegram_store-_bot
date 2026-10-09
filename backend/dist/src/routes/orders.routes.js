"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
exports.fulfillOrder = fulfillOrder;
exports.creditWallet = creditWallet;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
const bot_js_1 = require("../bot.js");
const client_1 = require("@prisma/client");
exports.ordersRouter = (0, express_1.Router)();
exports.ordersRouter.get('/', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const q = req.query;
    const where = {};
    if (q.paymentStatus)
        where.paymentStatus = q.paymentStatus;
    if (q.paymentMethod)
        where.paymentMethod = q.paymentMethod;
    if (q.search) {
        const s = String(q.search);
        where.OR = [{ orderNo: { contains: s, mode: 'insensitive' } }, { txid: { contains: s } }];
    }
    if (q.from || q.to) {
        where.createdAt = {
            ...(q.from ? { gte: new Date(String(q.from)) } : {}),
            ...(q.to ? { lte: new Date(String(q.to)) } : {}),
        };
    }
    const [total, items] = await Promise.all([
        db_js_1.prisma.order.count({ where }),
        db_js_1.prisma.order.findMany({
            where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize,
            include: { product: { select: { name: true } }, user: { select: { telegramId: true, username: true, firstName: true } } },
        }),
    ]);
    res.json({ total, page: pg.page, pageSize: pg.pageSize, items: items.map((o) => ({ ...o, userId: o.userId.toString(), user: { ...o.user, telegramId: o.user.telegramId.toString() } })) });
});
function serialize(o) {
    const c = { ...o };
    for (const k of ['userId'])
        if (typeof c[k] === 'bigint')
            c[k] = String(c[k]);
    return c;
}
exports.ordersRouter.get('/:id', auth_js_1.requireAuth, async (req, res) => {
    const o = await db_js_1.prisma.order.findFirst({
        where: { OR: [{ id: req.params.id }, { orderNo: req.params.id }] },
        include: {
            product: true, user: true,
            walletTxns: true,
        },
    });
    if (!o)
        return res.status(404).json({ error: 'not found' });
    const binance = o.binancePayOrderNo ? await db_js_1.prisma.binancePayment.findUnique({ where: { merchantOrderNo: o.binancePayOrderNo } }).catch(() => null) : null;
    res.json({ ...serialize(o), user: { ...serialize(o.user), telegramId: o.user.telegramId.toString() }, binance });
});
async function creditWallet(userTelegramId, amount, note, orderId, adminId, type = 'DEPOSIT') {
    const user = await db_js_1.prisma.user.findUnique({ where: { telegramId: userTelegramId } });
    if (!user)
        throw new Error('user not found');
    const next = new client_1.Prisma.Decimal(user.walletBalance).plus(new client_1.Prisma.Decimal(amount));
    await db_js_1.prisma.$transaction([
        db_js_1.prisma.user.update({ where: { telegramId: userTelegramId }, data: { walletBalance: next } }),
        db_js_1.prisma.walletTransaction.create({ data: { userId: userTelegramId, type: type, amount: new client_1.Prisma.Decimal(amount), balanceAfter: next, note, orderId, adminId } }),
    ]);
    return next;
}
async function fulfillOrder(orderId) {
    const order = await db_js_1.prisma.order.findUnique({ where: { id: orderId }, include: { product: true, user: true } });
    if (!order || order.paymentStatus !== 'PAID')
        return;
    if (order.product.deliveryMode === 'AUTO') {
        const items = await db_js_1.prisma.stockItem.findMany({ where: { productId: order.productId, isSold: false }, take: order.qty });
        if (items.length < order.qty) {
            await db_js_1.prisma.order.update({ where: { id: orderId }, data: { deliveryStatus: 'FAILED' } });
            await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `⚠️ Order <code>${order.orderNo}</code> paid but out of stock. Support will deliver manually.`);
            return;
        }
        await db_js_1.prisma.$transaction([
            db_js_1.prisma.stockItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { isSold: true, orderId } }),
            db_js_1.prisma.order.update({ where: { id: orderId }, data: { deliveryStatus: 'DELIVERED', deliveredData: items.map((i) => i.data).join('\n') } }),
        ]);
        const delivered = items.map((i) => `<code>${escapeHtml(i.data)}</code>`).join('\n');
        const tpl = (0, bot_js_1.renderTemplate)(order.product.deliveryTemplate || '{{keys}}', {
            keys: items.map((i) => i.data).join('\n'),
            username: order.user.username ?? '', orderNo: order.orderNo, product: order.product.name,
        });
        await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `✅ <b>Order ${order.orderNo} delivered!</b>\n\n${escapeHtml(tpl)}\n\n${delivered}`);
    }
    else {
        await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `✅ Payment received for <code>${order.orderNo}</code>. Manual delivery within 24h — support will contact you.`);
    }
    // Referral commission
    if (order.user.referredByUserId) {
        const s = await db_js_1.prisma.setting.findUnique({ where: { key: 'referralPercent' } });
        const pct = Number(s?.value ?? 5);
        if (pct > 0) {
            const bonus = new client_1.Prisma.Decimal(order.amountUsdt).mul(pct).div(100);
            const ref = await db_js_1.prisma.user.findUnique({ where: { telegramId: order.user.referredByUserId } });
            if (ref) {
                const next = new client_1.Prisma.Decimal(ref.walletBalance).plus(bonus);
                const nextEarn = new client_1.Prisma.Decimal(ref.referralEarnings).plus(bonus);
                await db_js_1.prisma.$transaction([
                    db_js_1.prisma.user.update({ where: { telegramId: ref.telegramId }, data: { walletBalance: next, referralEarnings: nextEarn } }),
                    db_js_1.prisma.walletTransaction.create({ data: { userId: ref.telegramId, type: 'REFERRAL', amount: bonus, balanceAfter: next, note: `Referral ${pct}% from order ${order.orderNo}` } }),
                ]);
            }
        }
    }
}
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
exports.ordersRouter.post('/:id/action', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER', 'SUPPORT'), async (req, res) => {
    const { action } = req.body;
    const adminId = req.adminId;
    const order = await db_js_1.prisma.order.findFirst({ where: { OR: [{ id: req.params.id }, { orderNo: req.params.id }] }, include: { product: true } });
    if (!order)
        return res.status(404).json({ error: 'not found' });
    const before = { ...order, userId: order.userId.toString() };
    if (action === 'markPaid') {
        await db_js_1.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
        await fulfillOrder(order.id);
    }
    else if (action === 'refund') {
        if (order.paymentStatus !== 'PAID')
            return res.status(400).json({ error: 'only PAID can be refunded' });
        await creditWallet(order.userId, order.amountUsdt, `Refund order ${order.orderNo}`, order.id, adminId);
        await db_js_1.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED' } });
        await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `💸 Order <code>${order.orderNo}</code> refunded to wallet: $${Number(order.amountUsdt).toFixed(2)}`);
    }
    else if (action === 'resend') {
        const o2 = await db_js_1.prisma.order.findUnique({ where: { id: order.id } });
        if (o2?.deliveredData)
            await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `📦 Redelivery for <code>${order.orderNo}</code>:\n\n${escapeHtml(o2.deliveredData)}`);
        else
            await fulfillOrder(order.id);
    }
    else if (action === 'cancel') {
        await db_js_1.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
    }
    else
        return res.status(400).json({ error: 'unknown action' });
    const after = await db_js_1.prisma.order.findUnique({ where: { id: order.id } });
    await (0, auth_js_1.audit)(adminId, `order:${action}`, 'order', order.id, before, { ...after, userId: String(after.userId) }, req.ip ?? '');
    await (0, bot_js_1.notifyAdmins)(`🧾 Order <code>${order.orderNo}</code> → ${action} by admin`);
    res.json({ ok: true });
});
