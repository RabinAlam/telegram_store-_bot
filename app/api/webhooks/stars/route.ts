import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { fulfillOrder } from '@/lib/fulfill';
// Telegram Bot API sends pre_checkout_query + successful_payment updates.
// Idempotent: dedupe by payload (= intent id).
const seen = new Set<string>();
export async function POST(req: Request) {
  const update = await req.json().catch(() => ({}));
  if (update.pre_checkout_query) {
    const token = process.env.BOT_TOKEN ?? '';
    if (token) {
      await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }) }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }
  const pay = update.message?.successful_payment;
  if (pay) {
    const intentId = String(pay.invoice_payload ?? '');
    if (seen.has(intentId)) return NextResponse.json({ ok: true, deduped: true });
    seen.add(intentId);
    const it = store.getIntent(intentId);
    if (it && it.status === 'PENDING') {
      store.setIntent(it.id, { status: 'CONFIRMED', txHash: pay.telegram_payment_charge_id });
      await fulfillOrder(it.orderId);
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true });
}
