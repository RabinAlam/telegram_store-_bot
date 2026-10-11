"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminsRouter = exports.authRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const validators_js_1 = require("../validators.js");
const auth_js_1 = require("../auth.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/login', async (req, res) => {
    const p = validators_js_1.loginDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    try {
        const admin = await db_js_1.prisma.admin.findUnique({ where: { email: p.data.email } });
        if (!admin)
            return res.status(401).json({ error: 'invalid credentials' });
        const ok = await (0, auth_js_1.verifyPassword)(p.data.password, admin.passwordHash);
        if (!ok)
            return res.status(401).json({ error: 'invalid credentials' });
        await db_js_1.prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }).catch(() => null);
        await (0, auth_js_1.audit)(admin.id, 'login', 'admin', admin.id, null, { email: admin.email }, req.ip ?? '').catch(() => null);
        res.json({ accessToken: (0, auth_js_1.signAccess)(admin.id, admin.role), refreshToken: (0, auth_js_1.signRefresh)(admin.id), admin: { id: admin.id, email: admin.email, role: admin.role } });
    }
    catch {
        return res.status(503).json({ error: 'service unavailable (database offline)' });
    }
});
exports.authRouter.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken)
        return res.status(400).json({ error: 'missing refresh token' });
    try {
        const p = (0, auth_js_1.verifyRefresh)(refreshToken);
        const admin = await db_js_1.prisma.admin.findUnique({ where: { id: p.sub } });
        if (!admin)
            return res.status(401).json({ error: 'invalid' });
        res.json({ accessToken: (0, auth_js_1.signAccess)(admin.id, admin.role) });
    }
    catch {
        return res.status(401).json({ error: 'invalid refresh' });
    }
});
exports.authRouter.get('/me', auth_js_1.requireAuth, async (req, res) => {
    const adminId = req.adminId;
    const admin = await db_js_1.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin)
        return res.status(404).json({ error: 'not found' });
    res.json({ id: admin.id, email: admin.email, role: admin.role });
});
exports.authRouter.post('/change-password', auth_js_1.requireAuth, async (req, res) => {
    const adminId = req.adminId;
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
        return res.status(400).json({ error: 'new password too short' });
    const admin = await db_js_1.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !(await (0, auth_js_1.verifyPassword)(oldPassword, admin.passwordHash)))
        return res.status(401).json({ error: 'wrong password' });
    await db_js_1.prisma.admin.update({ where: { id: adminId }, data: { passwordHash: await (0, auth_js_1.hashPassword)(newPassword) } });
    await (0, auth_js_1.audit)(adminId, 'change-password', 'admin', adminId, null, null, req.ip ?? '');
    res.json({ ok: true });
});
exports.adminsRouter = (0, express_1.Router)();
exports.adminsRouter.get('/', auth_js_1.requireAuth, async (_req, res) => {
    const list = await db_js_1.prisma.admin.findMany({ select: { id: true, email: true, role: true, lastLoginAt: true, createdAt: true } });
    res.json(list);
});
exports.adminsRouter.post('/', auth_js_1.requireAuth, async (req, res) => {
    const role = req.adminRole;
    if (role !== 'SUPER_ADMIN')
        return res.status(403).json({ error: 'super admin only' });
    const p = validators_js_1.createAdminDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const created = await db_js_1.prisma.admin.create({ data: { email: p.data.email, passwordHash: await (0, auth_js_1.hashPassword)(p.data.password), role: p.data.role } });
    await (0, auth_js_1.audit)(req.adminId, 'create', 'admin', created.id, null, { email: created.email, role: created.role }, req.ip ?? '');
    res.status(201).json({ id: created.id, email: created.email, role: created.role });
});
exports.adminsRouter.delete('/:id', auth_js_1.requireAuth, async (req, res) => {
    const role = req.adminRole;
    if (role !== 'SUPER_ADMIN')
        return res.status(403).json({ error: 'super admin only' });
    const before = await db_js_1.prisma.admin.findUnique({ where: { id: req.params.id } });
    await db_js_1.prisma.admin.delete({ where: { id: req.params.id } });
    await (0, auth_js_1.audit)(req.adminId, 'delete', 'admin', req.params.id, before, null, req.ip ?? '');
    res.json({ ok: true });
});
