import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { paginationDto } from '../validators.js';

export const auditRouter = Router();
auditRouter.get('/', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const q = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (q.action) where.action = { contains: String(q.action) };
  if (q.entity) where.entity = String(q.entity);
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize, include: { admin: { select: { email: true } } } }),
  ]);
  res.json({ total, items });
});
