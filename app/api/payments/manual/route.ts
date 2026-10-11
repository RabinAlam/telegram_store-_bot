export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
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
