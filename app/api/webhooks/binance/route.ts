import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { fulfillOrder } from '@/lib/fulfill';
// Binance Pay merchant callback OR manual admin confirm posts here.
// Without BINANCE_PAY_API_KEY -> stays PENDING + flagged for manual review.
const schema = z.object({ intentId: z.string(), uid: z.string(), amount: z.number().optional(), autoVerified: z.boolean().optional() });
export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const p = schema.safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const it = store.getIntent(p.data.intentId);
  if (!it) return NextResponse.json({ error: 'unknown' }, { status: 404 });
  if (it.status !== 'PENDING') return NextResponse.json({ ok: true, state: it.status });
  const hasKey = Boolean(process.env.BINANCE_PAY_API_KEY);
  if (p.data.autoVerified && hasKey) {
    store.setIntent(it.id, { status: 'CONFIRMED', txHash: `binance:${p.data.uid}` });
    await fulfillOrder(it.orderId);
    return NextResponse.json({ ok: true, fulfilled: true });
  }
  store.setIntent(it.id, { status: 'NEEDS_REVIEW', txHash: `binance:${p.data.uid}` });
  store.setOrderStatus(it.orderId, 'NEEDS_REVIEW');
  return NextResponse.json({ ok: true, review: true, note: 'Set BINANCE_PAY_API_KEY for auto-match; otherwise approve in /admin.' });
}
