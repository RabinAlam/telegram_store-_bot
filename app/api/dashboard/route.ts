export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { store } from '@/lib/store';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const orders = store.allOrders();
    const today = new Date().toISOString().slice(0, 10);

    const todayOrders = orders.filter((o) => o.createdAt.startsWith(today));
    const todayRevenue = todayOrders
      .filter((o) => o.status === 'DELIVERED' || o.status === 'PAID')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const pendingDeposits = orders.filter((o) => o.status === 'PENDING' || o.status === 'NEEDS_REVIEW').length;

    // Daily revenue series (last 7 days)
    const dates: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      dates[d] = 0;
    }
    orders.forEach((o) => {
      const d = o.createdAt?.slice(0, 10);
      if (d && dates[d] !== undefined && (o.status === 'DELIVERED' || o.status === 'PAID')) {
        dates[d] += o.total || 0;
      }
    });

    const revenueSeries = Object.entries(dates).map(([date, revenue]) => ({
      date: date.slice(5),
      revenue: Math.round(revenue * 100) / 100,
    }));

    // Top products
    const productStats: Record<string, { revenue: number; count: number }> = {};
    const prods = store.allProducts();
    const prodMap = Object.fromEntries(prods.map((p) => [p.id, p.title]));

    orders.forEach((o) => {
      const title = prodMap[o.productId] || o.productId;
      if (!productStats[title]) productStats[title] = { revenue: 0, count: 0 };
      productStats[title].count += o.qty || 1;
      productStats[title].revenue += o.total || 0;
    });

    const topProducts = Object.entries(productStats)
      .map(([name, stat]) => ({ name, revenue: Math.round(stat.revenue * 100) / 100, count: stat.count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Payment donut
    const statusCounts: Record<string, number> = {};
    orders.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });
    const paymentDonut = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Recent orders
    const recentOrders = orders.slice(0, 8).map((o) => ({
      id: o.id,
      orderNo: o.id.slice(0, 8).toUpperCase(),
      amountUsdt: o.total,
      paymentStatus: o.status,
    }));

    // Bot health
    const prisma = db();
    let newUsers = 0;
    if (prisma) {
      newUsers = await prisma.user.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }).catch(() => 0);
    }

    return NextResponse.json({
      kpis: {
        todayRevenue,
        ordersToday: todayOrders.length,
        newUsers,
        pendingDeposits,
      },
      revenueSeries,
      topProducts,
      paymentDonut,
      recentOrders,
      botHealth: {
        webhookConfigured: Boolean(process.env.BOT_TOKEN),
        lastWebhookAt: null,
        lastWebhookStatus: 'OK',
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json({ error: 'failed to load dashboard' }, { status: 500 });
  }
}
