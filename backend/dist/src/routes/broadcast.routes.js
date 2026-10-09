"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
const queues_js_1 = require("../queues.js");
const broadcast_worker_js_1 = require("../broadcast.worker.js");
exports.broadcastRouter = (0, express_1.Router)();
exports.broadcastRouter.get('/', auth_js_1.requireAuth, async (_req, res) => {
    res.json(await db_js_1.prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }));
});
exports.broadcastRouter.post('/', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.broadcastDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const b = await db_js_1.prisma.broadcast.create({ data: { ...p.data, status: 'DRAFT' } });
    await (0, auth_js_1.audit)(req.adminId, 'create', 'broadcast', b.id, null, b, req.ip ?? '');
    res.status(201).json(b);
});
exports.broadcastRouter.post('/:id/send', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const b = await db_js_1.prisma.broadcast.findUnique({ where: { id: req.params.id } });
    if (!b)
        return res.status(404).json({ error: 'not found' });
    const { segment = 'all' } = req.body;
    await db_js_1.prisma.broadcast.update({ where: { id: b.id }, data: { status: 'QUEUED' } });
    try {
        await queues_js_1.broadcastQueue.add('send', { broadcastId: b.id, segment }, { attempts: 2 });
    }
    catch {
        // Redis down (dev/small deploy): process inline without blocking the response
        setImmediate(() => (0, broadcast_worker_js_1.processBroadcast)(b.id, segment).catch(() => null));
    }
    await (0, auth_js_1.audit)(req.adminId, 'broadcast:send', 'broadcast', b.id, b.status, 'QUEUED', req.ip ?? '');
    res.json({ ok: true });
});
