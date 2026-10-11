import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { fulfillOrder } from '@/lib/fulfill';
// NOWPayments-style webhook OR self-hosted watcher posts { intentId, txHash, amount }.
// Idempotent by txHash; underpay/overpay -> NEEDS_REVIEW; exact -> CONFIRMED+fulfill once.
const seen = new Set<string>();
const schema = z.object({ intentId: z.string(), txHash: z.string(), amount: z.number() });
export async function POST(req: Request) {
  const secret = process.env.CRYPTO_WEBHOOK_SECRET;
  const token = req.headers.get('x-webhook-secret') || req.headers.get('x-admin-token');
  if (secret) {
    if (!token || (token !== secret && token !== process.env.ADMIN_API_TOKEN)) {
      return NextResponse.json({ error: 'unauthorized webhook' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized: webhook secret required in production' }, { status: 401 });
  }

  const j = await req.json().catch(() => ({}));
  const p = schema.safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  if (seen.has(p.data.txHash)) return NextResponse.json({ ok: true, deduped: true });
  seen.add(p.data.txHash);
  const it = store.getIntent(p.data.intentId);
  if (!it) return NextResponse.json({ error: 'unknown intent' }, { status: 404 });
  if (it.status !== 'PENDING') return NextResponse.json({ ok: true, state: it.status });

  // Prevent TxID replay attack across different intents
  const alreadyUsed = store.allIntents().some(
    (x) => x.id !== it.id && x.txHash === p.data.txHash && (x.status === 'CONFIRMED' || x.status === 'FULFILLED'),
  );
  if (alreadyUsed) {
    store.setIntent(it.id, { status: 'NEEDS_REVIEW', txHash: p.data.txHash });
    store.setOrderStatus(it.orderId, 'NEEDS_REVIEW');
    return NextResponse.json({ error: 'TxID already used for another intent', review: true }, { status: 400 });
  }

  const diff = Math.abs(p.data.amount - it.amount);
  if (diff > 0.000001) {
    store.setIntent(it.id, { status: 'NEEDS_REVIEW', txHash: p.data.txHash });
    store.setOrderStatus(it.orderId, 'NEEDS_REVIEW');
    return NextResponse.json({ ok: true, review: true });
  }
  store.setIntent(it.id, { status: 'CONFIRMED', txHash: p.data.txHash });
  await fulfillOrder(it.orderId);
  return NextResponse.json({ ok: true });
}
