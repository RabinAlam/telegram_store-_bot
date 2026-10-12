export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest, audit } from '@/lib/admin-jwt';
import { checkTxidOnBinance, autoMatchBinancePayment } from '@/lib/binance-check';
import { fulfillOrder } from '@/lib/fulfill';
import { store } from '@/lib/store';

// Admin-triggered auto-verify: checks the store's personal Binance Spot account
// for a matching deposit (by TxID if present, otherwise by amount).
// Called from the admin panel "🤖 Auto-verify" button on the Manual deposits queue.
export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'DB not available' }, { status: 503 });

  // Find order by orderNo (store id) or DB id
  const orderId = params.orderId;
  const order = await prisma.order.findFirst({
    where: { OR: [{ orderNo: orderId }, { id: orderId }] },
  }).catch(() => null);

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.paymentStatus === 'PAID') {
    return NextResponse.json({ matched: false, reason: 'Order already paid' }, { status: 400 });
  }

  try {
    let checkResult: Awaited<ReturnType<typeof checkTxidOnBinance>>;

    if (order.txid && order.txid.trim().length >= 6) {
      // User already submitted a TxID — verify it directly
      checkResult = await checkTxidOnBinance(order.txid.trim(), Number(order.amountUsdt));
    } else {
      // No TxID — try to auto-match by amount from recent Binance Pay / deposits
      const since = order.createdAt.getTime();
      const autoResult = await autoMatchBinancePayment(Number(order.amountUsdt), since);
      checkResult = autoResult as typeof checkResult;
    }

    if (checkResult.state === 'no-keys') {
      return NextResponse.json({
        matched: false,
        reason: 'Binance Spot API keys not configured — add them in Settings → Payments, or approve manually.',
      }, { status: 400 });
    }

    if (checkResult.state !== 'matched') {
      return NextResponse.json({
        matched: false,
        reason: checkResult.reason,
        checked: (checkResult as any).checked,
      });
    }

    // Payment matched — check for TxID double-spend
    const matchedTxid = checkResult.txid || order.txid;
    if (matchedTxid) {
      const dup = await prisma.order.findFirst({
        where: { txid: matchedTxid, paymentStatus: 'PAID', id: { not: order.id } },
      }).catch(() => null);
      if (dup) {
        return NextResponse.json({
          matched: false,
          reason: `TxID ${matchedTxid} already credited to order ${dup.orderNo}`,
        }, { status: 400 });
      }
    }

    // Mark as paid in DB
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        ...(matchedTxid ? { txid: matchedTxid, binancePayOrderNo: matchedTxid } : {}),
      },
    }).catch(() => null);

    // Sync store and fulfill
    store.setOrderStatus(order.orderNo, 'PENDING');
    await fulfillOrder(order.orderNo);

    // Audit log
    const clientIp = req.headers.get('x-forwarded-for') || '';
    await audit(admin.id, 'deposit:auto-verify', 'order', order.id, { status: 'PENDING' }, { status: 'PAID', match: checkResult.reason }, clientIp).catch(() => null);

    return NextResponse.json({
      matched: true,
      reason: checkResult.reason,
      txid: matchedTxid,
      amount: checkResult.amount,
    });
  } catch (e: any) {
    console.error('Auto-verify error:', e);
    return NextResponse.json({ error: e.message || 'Auto-verify failed' }, { status: 500 });
  }
}
