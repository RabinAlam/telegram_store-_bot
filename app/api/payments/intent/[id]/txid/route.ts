import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { fulfillOrder } from '@/lib/fulfill';
import { checkTxidOnBinance } from '@/lib/binance-check';

// User pastes Binance Order ID / TxID on the pay page (testing mode: open to everyone).
// Saves it, auto-checks against our Spot deposit history, fulfills on match.
const schema = z.object({ txid: z.string().min(6).max(120) });
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const j = await req.json().catch(() => ({}));
  const p = schema.safeParse({ txid: String(j.txid ?? '').trim() });
  if (!p.success) return NextResponse.json({ error: 'Enter a valid TxID / Order ID (6+ chars)' }, { status: 400 });
  const it = store.getIntent(params.id);
  if (!it) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (it.status === 'CONFIRMED' || it.status === 'FULFILLED') return NextResponse.json({ ok: true, state: 'already', intent: it });
  if (it.status === 'CANCELLED' || it.status === 'EXPIRED') return NextResponse.json({ error: 'deposit expired — create a new one' }, { status: 400 });
  store.setIntent(it.id, { txHash: p.data.txid });
  const check = await checkTxidOnBinance(p.data.txid, it.amount);
  if (check.state === 'matched') {
    store.setIntent(it.id, { status: 'CONFIRMED' });
    await fulfillOrder(it.orderId);
    const order = store.getOrder(it.orderId);
    return NextResponse.json({ ok: true, state: 'matched', message: `✅ Verified on Binance — $${(check.amount ?? it.amount).toFixed(2)} received.`, intent: store.getIntent(it.id), orderStatus: order?.status });
  }
  if (check.state === 'not-found') {
    store.setIntent(it.id, { status: 'NEEDS_REVIEW' });
    store.setOrderStatus(it.orderId, 'NEEDS_REVIEW');
  }
  return NextResponse.json({ ok: true, state: check.state, message: check.state === 'no-keys' ? `📝 TxID saved. ${check.reason}` : `🔍 ${check.reason}`, intent: store.getIntent(it.id) });
}
