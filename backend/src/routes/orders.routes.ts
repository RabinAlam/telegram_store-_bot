import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { paginationDto } from '../validators.js';
import { sendUserMessage, notifyAdmins, renderTemplate } from '../bot.js';
import { Prisma } from '@prisma/client';

export const ordersRouter = Router();

ordersRouter.get('/', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const q = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
  if (q.paymentMethod) where.paymentMethod = q.paymentMethod;
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
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize,
      include: { product: { select: { name: true } }, user: { select: { telegramId: true, username: true, firstName: true } } },
    }),
  ]);
  res.json({ total, page: pg.page, pageSize: pg.pageSize, items: items.map((o) => ({ ...o, userId: o.userId.toString(), user: { ...o.user, telegramId: o.user.telegramId.toString() } })) });
});

function serialize(o: Record<string, unknown>) {
  const c = { ...o } as Record<string, unknown>;
  for (const k of ['userId']) if (typeof c[k] === 'bigint') c[k] = String(c[k]);
  return c;
}

ordersRouter.get('/:id', requireAuth, async (req, res) => {
  const o = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { orderNo: req.params.id }] },
    include: {
      product: true, user: true,
      walletTxns: true,
    },
  });
  if (!o) return res.status(404).json({ error: 'not found' });
  const binance = o.binancePayOrderNo ? await prisma.binancePayment.findUnique({ where: { merchantOrderNo: o.binancePayOrderNo } }).catch(() => null) : null;
  res.json({ ...serialize(o as unknown as Record<string, unknown>), user: { ...serialize(o.user as unknown as Record<string, unknown>), telegramId: o.user.telegramId.toString() }, binance });
});

async function creditWallet(userTelegramId: bigint, amount: Prisma.Decimal | number | string, note: string, orderId?: string, adminId?: string, type: 'DEPOSIT' | 'PURCHASE' | 'REFERRAL' | 'ADMIN_ADJUST' = 'DEPOSIT') {
  const user = await prisma.user.findUnique({ where: { telegramId: userTelegramId } });
  if (!user) throw new Error('user not found');
  const next = new Prisma.Decimal(user.walletBalance).plus(new Prisma.Decimal(amount));
  await prisma.$transaction([
    prisma.user.update({ where: { telegramId: userTelegramId }, data: { walletBalance: next } }),
    prisma.walletTransaction.create({ data: { userId: userTelegramId, type: type as never, amount: new Prisma.Decimal(amount), balanceAfter: next, note, orderId, adminId } }),
  ]);
  return next;
}

export async function fulfillOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { product: true, user: true } });
  if (!order || order.paymentStatus !== 'PAID') return;
  if (order.product.deliveryMode === 'AUTO') {
    const items = await prisma.stockItem.findMany({ where: { productId: order.productId, isSold: false }, take: order.qty });
    if (items.length < order.qty) {
      await prisma.order.update({ where: { id: orderId }, data: { deliveryStatus: 'FAILED' } });
      await sendUserMessage(order.userId.toString(), `⚠️ Order <code>${order.orderNo}</code> paid but out of stock. Support will deliver manually.`);
      return;
    }
    await prisma.$transaction([
      prisma.stockItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { isSold: true, orderId } }),
      prisma.order.update({ where: { id: orderId }, data: { deliveryStatus: 'DELIVERED', deliveredData: items.map((i) => i.data).join('\n') } }),
    ]);
    const delivered = items.map((i) => `<code>${escapeHtml(i.data)}</code>`).join('\n');
    const tpl = renderTemplate(order.product.deliveryTemplate || '{{keys}}', {
      keys: items.map((i) => i.data).join('\n'),
      username: order.user.username ?? '', orderNo: order.orderNo, product: order.product.name,
    });
    await sendUserMessage(order.userId.toString(), `✅ <b>Order ${order.orderNo} delivered!</b>\n\n${escapeHtml(tpl)}\n\n${delivered}`);
  } else {
    await sendUserMessage(order.userId.toString(), `✅ Payment received for <code>${order.orderNo}</code>. Manual delivery within 24h — support will contact you.`);
  }
  // Referral commission
  if (order.user.referredByUserId) {
    const s = await prisma.setting.findUnique({ where: { key: 'referralPercent' } });
    const pct = Number((s?.value as number) ?? 5);
    if (pct > 0) {
      const bonus = new Prisma.Decimal(order.amountUsdt).mul(pct).div(100);
      const ref = await prisma.user.findUnique({ where: { telegramId: order.user.referredByUserId } });
      if (ref) {
        const next = new Prisma.Decimal(ref.walletBalance).plus(bonus);
        const nextEarn = new Prisma.Decimal(ref.referralEarnings).plus(bonus);
        await prisma.$transaction([
          prisma.user.update({ where: { telegramId: ref.telegramId }, data: { walletBalance: next, referralEarnings: nextEarn } }),
          prisma.walletTransaction.create({ data: { userId: ref.telegramId, type: 'REFERRAL', amount: bonus, balanceAfter: next, note: `Referral ${pct}% from order ${order.orderNo}` } }),
        ]);
      }
    }
  }
}

function escapeHtml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

ordersRouter.post('/:id/action', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER', 'SUPPORT'), async (req, res) => {
  const { action } = req.body as { action: 'markPaid' | 'refund' | 'resend' | 'cancel' };
  const adminId = (req as never as { adminId: string }).adminId;
  const order = await prisma.order.findFirst({ where: { OR: [{ id: req.params.id }, { orderNo: req.params.id }] }, include: { product: true } });
  if (!order) return res.status(404).json({ error: 'not found' });
  const before = { ...order, userId: order.userId.toString() };
  if (action === 'markPaid') {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
    await fulfillOrder(order.id);
  } else if (action === 'refund') {
    if (order.paymentStatus !== 'PAID') return res.status(400).json({ error: 'only PAID can be refunded' });
    await creditWallet(order.userId, order.amountUsdt, `Refund order ${order.orderNo}`, order.id, adminId);
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED' } });
    await sendUserMessage(order.userId.toString(), `💸 Order <code>${order.orderNo}</code> refunded to wallet: $${Number(order.amountUsdt).toFixed(2)}`);
  } else if (action === 'resend') {
    const o2 = await prisma.order.findUnique({ where: { id: order.id } });
    if (o2?.deliveredData) await sendUserMessage(order.userId.toString(), `📦 Redelivery for <code>${order.orderNo}</code>:\n\n${escapeHtml(o2.deliveredData)}`);
    else await fulfillOrder(order.id);
  } else if (action === 'cancel') {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
  } else return res.status(400).json({ error: 'unknown action' });
  const after = await prisma.order.findUnique({ where: { id: order.id } });
  await audit(adminId, `order:${action}`, 'order', order.id, before, { ...after, userId: String((after as unknown as { userId: bigint }).userId) }, req.ip ?? '');
  await notifyAdmins(`🧾 Order <code>${order.orderNo}</code> → ${action} by admin`);
  res.json({ ok: true });
});

export { creditWallet };
