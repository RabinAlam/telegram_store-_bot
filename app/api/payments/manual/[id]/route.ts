export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { db } from '@/lib/db';
import { getAdminFromRequest, audit } from '@/lib/admin-jwt';
import { fulfillOrder } from '@/lib/fulfill';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const approve = Boolean(json?.approve);
  const note: string = json?.note || (approve ? 'approved via panel' : 'rejected via panel');
  const orderId = params.id;

  try {
    const prisma = db();
    if (prisma) {
      // Find by orderNo (what the manual list returns as id)
      const order = await prisma.order.findFirst({
        where: { OR: [{ orderNo: orderId }, { id: orderId }] },
      }).catch(() => null);

      if (order) {
        if (approve) {
          // Check TxID uniqueness
          if (order.txid) {
            const dup = await prisma.order.findFirst({
              where: { txid: order.txid, paymentStatus: 'PAID', id: { not: order.id } },
            }).catch(() => null);
            if (dup) return NextResponse.json({ error: `TxID already credited to order ${dup.orderNo}` }, { status: 400 });
          }
          await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } }).catch(() => null);
          store.setOrderStatus(order.orderNo, 'PENDING');
          await fulfillOrder(order.orderNo);
        } else {
          await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } }).catch(() => null);
          store.setOrderStatus(order.orderNo, 'CANCELLED');
        }
        const clientIp = req.headers.get('x-forwarded-for') || '';
        await audit(admin.id, approve ? 'deposit:approve' : 'deposit:reject', 'order', order.id, { status: 'PENDING' }, { approve, note }, clientIp).catch(() => null);
        return NextResponse.json({ ok: true, status: approve ? 'PAID' : 'FAILED' });
      }
    }

    // Fallback: in-memory store only (local dev without DB)
    const nextStatus = approve ? 'DELIVERED' : 'CANCELLED';
    store.setOrderStatus(orderId, nextStatus);
    const clientIp = req.headers.get('x-forwarded-for') || '';
    await audit(admin.id, approve ? 'approve' : 'reject', 'payment', orderId, null, { approve }, clientIp).catch(() => null);
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'action failed' }, { status: 400 });
  }
}

