import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { adjustDto, paginationDto } from '../validators.js';
import { sendUserMessage } from '../bot.js';
import { Prisma } from '@prisma/client';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const { search = '' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (search) {
    const s = String(search);
    if (/^\d+$/.test(s)) where.telegramId = BigInt(s);
    else where.OR = [{ username: { contains: s, mode: 'insensitive' } }, { firstName: { contains: s, mode: 'insensitive' } }];
  }
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize }),
  ]);
  res.json({ total, items: items.map((u) => ({ ...u, telegramId: u.telegramId.toString(), referredByUserId: u.referredByUserId?.toString() ?? null })) });
});

usersRouter.get('/:telegramId', requireAuth, async (req, res) => {
  const tid = BigInt(req.params.telegramId);
  const user = await prisma.user.findUnique({ where: { telegramId: tid }, include: { orders: { orderBy: { createdAt: 'desc' }, take: 20, include: { product: true } }, walletTxns: { orderBy: { createdAt: 'desc' }, take: 50 } } });
  if (!user) return res.status(404).json({ error: 'not found' });
  const referrals = await prisma.user.findMany({ where: { referredByUserId: tid } });
  const totalSpent = await prisma.order.aggregate({ where: { userId: tid, paymentStatus: 'PAID' }, _sum: { amountUsdt: true } });
  res.json({
    ...user, telegramId: user.telegramId.toString(), referredByUserId: user.referredByUserId?.toString() ?? null,
    orders: user.orders, walletTxns: user.walletTxns.map((t) => ({ ...t, userId: t.userId.toString() })),
    referrals: referrals.map((r) => ({ ...r, telegramId: r.telegramId.toString() })),
    totalSpent: Number(totalSpent._sum.amountUsdt ?? 0),
  });
});

usersRouter.post('/:telegramId/adjust', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = adjustDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const adminId = (req as never as { adminId: string }).adminId;
  const tid = BigInt(req.params.telegramId);
  const user = await prisma.user.findUnique({ where: { telegramId: tid } });
  if (!user) return res.status(404).json({ error: 'not found' });
  const next = new Prisma.Decimal(user.walletBalance).plus(new Prisma.Decimal(p.data.delta));
  if (next.isNegative()) return res.status(400).json({ error: 'insufficient balance' });
  await prisma.$transaction([
    prisma.user.update({ where: { telegramId: tid }, data: { walletBalance: next } }),
    prisma.walletTransaction.create({ data: { userId: tid, type: 'ADMIN_ADJUST', amount: new Prisma.Decimal(p.data.delta), balanceAfter: next, note: p.data.reason, adminId } }),
  ]);
  await audit(adminId, 'wallet:adjust', 'user', String(tid), { balance: String(user.walletBalance) }, { balance: next.toString(), delta: p.data.delta, reason: p.data.reason }, req.ip ?? '');
  await sendUserMessage(String(tid), `💳 Wallet adjusted: ${p.data.delta > 0 ? '+' : ''}$${p.data.delta.toFixed(2)}. Reason: ${p.data.reason}`);
  res.json({ ok: true, balance: next.toString() });
});

usersRouter.post('/:telegramId/ban', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const adminId = (req as never as { adminId: string }).adminId;
  const tid = BigInt(req.params.telegramId);
  const { banned } = req.body as { banned: boolean };
  const before = await prisma.user.findUnique({ where: { telegramId: tid } });
  const u = await prisma.user.update({ where: { telegramId: tid }, data: { status: banned ? 'BANNED' : 'ACTIVE' } });
  await audit(adminId, banned ? 'user:ban' : 'user:unban', 'user', String(tid), before?.status, u.status, req.ip ?? '');
  res.json({ ok: true, status: u.status });
});

usersRouter.post('/:telegramId/reset-ref', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const adminId = (req as never as { adminId: string }).adminId;
  const tid = BigInt(req.params.telegramId);
  const code = `TZ${String(tid).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
  const before = await prisma.user.findUnique({ where: { telegramId: tid } });
  const u = await prisma.user.update({ where: { telegramId: tid }, data: { referralCode: code } });
  await audit(adminId, 'user:reset-ref', 'user', String(tid), before?.referralCode, code, req.ip ?? '');
  res.json({ ok: true, referralCode: u.referralCode });
});
