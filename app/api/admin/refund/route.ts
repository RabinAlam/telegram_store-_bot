import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { requireAdminToken } from '@/lib/admin-auth';
// Stars refund via refundStarPayment (admin action). Demo without token: simulated.
export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({ orderId: z.string() }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const order = store.getOrder(p.data.orderId);
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const token = process.env.BOT_TOKEN ?? '';
  if (token) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/refundStarPayment`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id: 0, telegram_payment_charge_id: order.id }) }).catch(() => {});
    } catch {}
  }
  store.setOrderStatus(order.id, 'REFUNDING');
  store.vaultReleaseByOrder(order.id);
  return NextResponse.json({ ok: true, status: 'REFUNDING' });
}
