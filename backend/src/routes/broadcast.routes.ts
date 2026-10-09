import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { broadcastDto } from '../validators.js';
import { broadcastQueue } from '../queues.js';
import { processBroadcast } from '../broadcast.worker.js';

export const broadcastRouter = Router();

broadcastRouter.get('/', requireAuth, async (_req, res) => {
  res.json(await prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }));
});

broadcastRouter.post('/', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = broadcastDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const b = await prisma.broadcast.create({ data: { ...p.data, status: 'DRAFT' } });
  await audit((req as never as { adminId: string }).adminId, 'create', 'broadcast', b.id, null, b, req.ip ?? '');
  res.status(201).json(b);
});

broadcastRouter.post('/:id/send', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const b = await prisma.broadcast.findUnique({ where: { id: req.params.id } });
  if (!b) return res.status(404).json({ error: 'not found' });
  const { segment = 'all' } = req.body as { segment?: 'all' | 'active7d' | 'buyers' | 'neverBought' };
  await prisma.broadcast.update({ where: { id: b.id }, data: { status: 'QUEUED' } });
  try {
    await broadcastQueue.add('send', { broadcastId: b.id, segment }, { attempts: 2 });
  } catch {
    // Redis down (dev/small deploy): process inline without blocking the response
    setImmediate(() => processBroadcast(b.id, segment).catch(() => null));
  }
  await audit((req as never as { adminId: string }).adminId, 'broadcast:send', 'broadcast', b.id, b.status, 'QUEUED', req.ip ?? '');
  res.json({ ok: true });
});
