"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
exports.settingsRouter = (0, express_1.Router)();
const PUBLIC_SAFE = new Set(['supportUrl', 'channelUrl', 'referralPercent', 'minDeposit', 'manualAddresses']);
exports.settingsRouter.get('/', auth_js_1.requireAuth, async (_req, res) => {
    const all = await db_js_1.prisma.setting.findMany();
    const masked = {};
    for (const s of all) {
        if (['botToken', 'binanceSecret', 'binanceApiKey'].includes(s.key))
            masked[s.key] = '••••••';
        else
            masked[s.key] = s.value;
    }
    res.json(masked);
});
exports.settingsRouter.put('/', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.settingDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const before = await db_js_1.prisma.setting.findUnique({ where: { key: p.data.key } });
    await db_js_1.prisma.setting.upsert({ where: { key: p.data.key }, update: { value: p.data.value }, create: { key: p.data.key, value: p.data.value } });
    await (0, auth_js_1.audit)(req.adminId, 'setting:update', 'setting', p.data.key, before?.value, p.data.value, req.ip ?? '');
    res.json({ ok: true });
});
exports.settingsRouter.get('/public', async (_req, res) => {
    const rows = await db_js_1.prisma.setting.findMany({ where: { key: { in: [...PUBLIC_SAFE] } } });
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
