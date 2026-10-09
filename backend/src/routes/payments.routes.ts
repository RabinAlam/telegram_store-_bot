import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { sendUserMessage, notifyAdmins } from '../bot.js';
import { creditWallet } from './orders.routes.js';
import { getDepositHistory, matchDeposit } from '../binance-spot.js';
import { paginationDto } from '../validators.js';

export const paymentsRouter = Router();

paymentsRouter.get('/binance', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const [total, items] = await Promise.all([
    prisma.binancePayment.count(),
    prisma.binancePayment.findMany({ orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize }),
  ]);
  res.json({ total, items });
});

// Manual deposits queue = orders with MANUAL_CRYPTO + PENDING (txid present)
paymentsRouter.get('/manual', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const where = { paymentMethod: 'MANUAL_CRYPTO' as const, paymentStatus: 'PENDING' as const };
  const [total, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize,
      include: { user: { select: { telegramId: true, username: true, firstName: true } }, product: { select: { name: true } } },
    }),
  ]);
  res.json({ total, items: items.map((o) => ({ ...o, userId: o.userId.toString(), user: { ...o.user, telegramId: o.user.telegramId.toString() } })) });
});

paymentsRouter.post('/manual/:orderId', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const { approve, note = '' } = req.body as { approve: boolean; note?: string };
  const adminId = (req as never as { adminId: string }).adminId;
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) return res.status(404).json({ error: 'not found' });
  if (order.paymentStatus !== 'PENDING') return res.status(400).json({ error: 'already decided' });
  if (approve) {
    // Manual crypto here acts as wallet top-up OR order payment: if product is wallet-topup pseudo, credit wallet; else mark paid+fulfill.
    // Spec: approve credits wallet, writes WalletTransaction + AuditLog, notifies user.
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    // If order amount is a deposit (product name contains deposit) credit wallet directly, else fulfill product order
    const { fulfillOrder } = await import('./orders.routes.js');
    await fulfillOrder(order.id);
    await creditWalletIfDeposit(order, adminId, note);
    await sendUserMessage(order.userId.toString(), `✅ Manual deposit <code>${order.orderNo}</code> approved. TXID: <code>${order.txid ?? '—'}</code> ${note}`);
  } else {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
    await sendUserMessage(order.userId.toString(), `❌ Manual deposit <code>${order.orderNo}</code> rejected. ${note} Contact support.`);
  }
  await audit(adminId, approve ? 'deposit:approve' : 'deposit:reject', 'order', order.id, { status: 'PENDING' }, { status: approve ? 'PAID' : 'FAILED', note }, req.ip ?? '');
  await notifyAdmins(`💰 Manual deposit <code>${order.orderNo}</code> ${approve ? 'approved' : 'rejected'}`);
  res.json({ ok: true });
});

// Auto-verify against the store's PERSONAL Binance account (Spot API).
// No merchant account needed. Checks on-chain USDT deposits for the order amount
// (+ TXID when the user submitted one). On match: same approve flow as manual.
paymentsRouter.post('/verify/:orderId', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const adminId = (req as never as { adminId: string }).adminId;
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) return res.status(404).json({ error: 'not found' });
  if (order.paymentStatus !== 'PENDING') return res.status(400).json({ error: 'already decided' });
  const get = async (k: string) => (await prisma.setting.findUnique({ where: { key: k } }))?.value as string | undefined;
  const apiKey = (await get('binanceSpotApiKey')) ?? process.env.BINANCE_SPOT_API_KEY ?? '';
  const secret = (await get('binanceSpotSecret')) ?? process.env.BINANCE_SPOT_SECRET ?? '';
  if (!apiKey || !secret) {
    return res.status(400).json({ matched: false, reason: 'Spot API keys not set — add them in Settings → Payments, or approve manually' });
  }
  let deposits;
  try {
    deposits = await getDepositHistory(apiKey, secret);
  } catch (e) {
    return res.status(502).json({ matched: false, reason: `Binance API error: ${e instanceof Error ? e.message : 'unreachable'} — approve manually` });
  }
  const m = matchDeposit(deposits, { amount: Number(order.amountUsdt), txid: order.txid ?? undefined });
  if (!m.matched) return res.json({ matched: false, reason: m.reason, checked: deposits.length });
  await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
  const { fulfillOrder } = await import('./orders.routes.js');
  await fulfillOrder(order.id);
  await creditWalletIfDeposit(order, adminId, `auto-verified: ${m.reason}`);
  await sendUserMessage(order.userId.toString(), `✅ Deposit <code>${order.orderNo}</code> auto-verified on Binance (${m.reason}). Thank you!`);
  await audit(adminId, 'deposit:auto-verify', 'order', order.id, { status: 'PENDING' }, { status: 'PAID', match: m.reason }, req.ip ?? '');
  await notifyAdmins(`🤖 Auto-verified <code>${order.orderNo}</code> $${Number(order.amountUsdt)} (${m.reason})`);
  res.json({ matched: true, reason: m.reason });
});

async function creditWalletIfDeposit(order: { userId: bigint; amountUsdt: unknown; orderNo: string }, adminId: string, note: string) {
  // For pure wallet top-up orders (product name starts with "Wallet"), also credit wallet.
  const full = await prisma.order.findUnique({ where: { orderNo: order.orderNo }, include: { product: true } });
  if (full && /wallet|deposit/i.test(full.product.name)) {
    await creditWallet(order.userId, String(full.amountUsdt), `Manual deposit ${order.orderNo} ${note}`, full.id, adminId);
  }
}
