export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { db } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    // Primary: read from DB (works on serverless cold starts)
    const prisma = db();
    if (prisma) {
      const dbOrders = await prisma.order.findMany({
        where: { paymentStatus: { in: ['PENDING', 'FAILED'] }, txid: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { telegramId: true, username: true } },
          product: { select: { name: true } },
        },
      }).catch(() => null);

      if (dbOrders && dbOrders.length >= 0) {
        const items = dbOrders.map((o) => ({
          id: o.orderNo,
          orderNo: o.orderNo,
          amountUsdt: Number(o.amountUsdt),
          txid: o.txid ?? null,
          createdAt: o.createdAt.toISOString(),
          user: { telegramId: o.user.telegramId.toString(), username: o.user.username ?? undefined },
          product: { name: o.product.name },
        }));
        return NextResponse.json({ items });
      }
    }

    // Fallback: in-memory store (local dev)
    const orders = store.allOrders();
    const prods = Object.fromEntries(store.allProducts().map((p) => [p.id, p.title]));

    const manual = orders
      .filter((o) => o.status === 'NEEDS_REVIEW' || o.status === 'PENDING')
      .map((o) => ({
        id: o.id,
        orderNo: o.id.slice(0, 8).toUpperCase(),
        amountUsdt: o.total,
        txid: (o as any).txid || (o as any).txHash || null,
        createdAt: o.createdAt,
        user: { telegramId: o.userTg, username: o.userTg },
        product: { name: prods[o.productId] || o.productId },
      }));

    return NextResponse.json({ items: manual });
  } catch (e) {
    console.error('Manual payments error:', e);
    return NextResponse.json({ items: [] });
  }
}
