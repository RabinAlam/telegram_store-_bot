"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referralsRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
exports.referralsRouter = (0, express_1.Router)();
exports.referralsRouter.get('/settings', auth_js_1.requireAuth, async (_req, res) => {
    const s = await db_js_1.prisma.setting.findUnique({ where: { key: 'referralPercent' } });
    res.json({ percent: Number(s?.value ?? 5) });
});
exports.referralsRouter.put('/settings', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const { percent } = req.body;
    if (typeof percent !== 'number' || percent < 0 || percent > 50)
        return res.status(400).json({ error: 'percent 0-50' });
    const before = await db_js_1.prisma.setting.findUnique({ where: { key: 'referralPercent' } });
    await db_js_1.prisma.setting.upsert({ where: { key: 'referralPercent' }, update: { value: percent }, create: { key: 'referralPercent', value: percent } });
    await (0, auth_js_1.audit)(req.adminId, 'referral:setting', 'setting', 'referralPercent', before?.value, percent, req.ip ?? '');
    res.json({ ok: true, percent });
});
exports.referralsRouter.get('/leaderboard', auth_js_1.requireAuth, async (_req, res) => {
    const rows = await db_js_1.prisma.user.findMany({ orderBy: { referralEarnings: 'desc' }, take: 50, select: { telegramId: true, username: true, firstName: true, referralEarnings: true, referralCode: true } });
    res.json(rows.map((r) => ({ ...r, telegramId: r.telegramId.toString() })));
});
exports.referralsRouter.get('/ledger', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const [total, items] = await Promise.all([
        db_js_1.prisma.walletTransaction.count({ where: { type: 'REFERRAL' } }),
        db_js_1.prisma.walletTransaction.findMany({ where: { type: 'REFERRAL' }, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize }),
    ]);
    res.json({ total, items: items.map((t) => ({ ...t, userId: t.userId.toString() })) });
});
