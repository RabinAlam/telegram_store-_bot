import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days ?? 30), 7), 90);
  const since = new Date(Date.now() - days * 86400000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [todayRevenue, ordersToday, newUsers, pendingDeposits, recentOrders] = await Promise.all([
    prisma.order.aggregate({ where: { paymentStatus: 'PAID', createdAt: { gte: todayStart } }, _sum: { amountUsdt: true } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { paymentMethod: 'MANUAL_CRYPTO', paymentStatus: 'PENDING' } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { product: { select: { name: true } } } }),
  ]);

  const daily = await prisma.$queryRaw<{ d: Date; revenue: number }[]>`
    SELECT date_trunc('day', "created_at") AS d, COALESCE(SUM("amount_usdt"),0)::float AS revenue
    FROM "orders" WHERE "payment_status"='PAID' AND "created_at" >= ${since}
    GROUP BY 1 ORDER BY 1`;
  const topProducts = await prisma.order.groupBy({ by: ['productId'], where: { paymentStatus: 'PAID', createdAt: { gte: since } }, _sum: { amountUsdt: true }, _count: true, orderBy: { _sum: { amountUsdt: 'desc' } }, take: 5 });
  const topWithNames = await Promise.all(topProducts.map(async (t) => {
    const p = await prisma.product.findUnique({ where: { id: t.productId } });
    return { name: p?.name ?? t.productId, revenue: Number(t._sum.amountUsdt ?? 0), count: t._count };
  }));
  const byStatus = await prisma.order.groupBy({ by: ['paymentStatus'], _count: true, where: { createdAt: { gte: since } } });

  const lastWebhook = await prisma.binancePayment.findFirst({ orderBy: { createdAt: 'desc' } });
  res.json({
    kpis: {
      todayRevenue: Number(todayRevenue._sum.amountUsdt ?? 0),
      ordersToday, newUsers, pendingDeposits,
    },
    revenueSeries: daily.map((r) => ({ date: r.d.toISOString().slice(0, 10), revenue: Number(r.revenue) })),
    topProducts: topWithNames,
    paymentDonut: byStatus.map((s) => ({ status: s.paymentStatus, count: s._count })),
    recentOrders: recentOrders.map((o) => ({ ...o, userId: o.userId.toString() })),
    botHealth: { webhookConfigured: !!process.env.BOT_TOKEN, lastWebhookAt: lastWebhook?.createdAt ?? null, lastWebhookStatus: lastWebhook?.status ?? null },
  });
});
