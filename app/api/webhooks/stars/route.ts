import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { fulfillOrder } from '@/lib/fulfill';
// Telegram Bot API sends pre_checkout_query + successful_payment updates.
// Idempotent: dedupe by payload (= intent id).
const seen = new Set<string>();
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = req.headers.get('x-telegram-bot-api-secret-token') || req.headers.get('x-admin-token');
  if (secret) {
    if (!token || (token !== secret && token !== process.env.ADMIN_API_TOKEN)) {
      return NextResponse.json({ error: 'unauthorized webhook' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'unauthorized: telegram webhook secret required in production' }, { status: 401 });
  }

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
