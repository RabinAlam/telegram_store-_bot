import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { paginationDto } from '../validators.js';

export const referralsRouter = Router();

referralsRouter.get('/settings', requireAuth, async (_req, res) => {
  const s = await prisma.setting.findUnique({ where: { key: 'referralPercent' } });
  res.json({ percent: Number((s?.value as number) ?? 5) });
});

referralsRouter.put('/settings', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const { percent } = req.body as { percent: number };
  if (typeof percent !== 'number' || percent < 0 || percent > 50) return res.status(400).json({ error: 'percent 0-50' });
  const before = await prisma.setting.findUnique({ where: { key: 'referralPercent' } });
  await prisma.setting.upsert({ where: { key: 'referralPercent' }, update: { value: percent }, create: { key: 'referralPercent', value: percent } });
  await audit((req as never as { adminId: string }).adminId, 'referral:setting', 'setting', 'referralPercent', before?.value, percent, req.ip ?? '');
  res.json({ ok: true, percent });
});

referralsRouter.get('/leaderboard', requireAuth, async (_req, res) => {
  const rows = await prisma.user.findMany({ orderBy: { referralEarnings: 'desc' }, take: 50, select: { telegramId: true, username: true, firstName: true, referralEarnings: true, referralCode: true } });
  res.json(rows.map((r) => ({ ...r, telegramId: r.telegramId.toString() })));
});

referralsRouter.get('/ledger', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const [total, items] = await Promise.all([
    prisma.walletTransaction.count({ where: { type: 'REFERRAL' } }),
    prisma.walletTransaction.findMany({ where: { type: 'REFERRAL' }, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize }),
  ]);
  res.json({ total, items: items.map((t) => ({ ...t, userId: t.userId.toString() })) });
});
