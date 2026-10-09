import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { sessionFromRequest } from '@/lib/auth';
import { requireAdminToken } from '@/lib/admin-auth';
function admin(req: Request) {
  if (process.env.ADMIN_TG_IDS) { const s = sessionFromRequest(req); return s?.role === 'ADMIN'; }
  return true; // open in dev; RBAC enforced when ADMIN_TG_IDS set
}
export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  if (!admin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const j = await req.json().catch(() => ({}));
  const p = z.object({ productId: z.string(), qty: z.number().int().min(1), message: z.string().optional() }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const r = { id: `r_${Date.now()}`, productId: p.data.productId, qty: p.data.qty, message: p.data.message ?? `Restocked ${p.data.productId} × ${p.data.qty}`, createdAt: new Date().toISOString() };
  store.addRestock(r);
  await broadcast(r).catch(() => {});
  return NextResponse.json({ restock: r });
}
async function broadcast(r: { productId: string; qty: number; message: string }) {
  const token = process.env.BOT_TOKEN ?? '';
  const channel = process.env.RESTOCK_CHANNEL ?? '';
  const url = process.env.WEBAPP_URL ?? '';
  if (!token || !channel) return;
  const text = `🎁 Restocked!\nProduct: ${r.productId}\n✅ Available: ${r.qty}\n💎 ${r.message}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: channel, text, reply_markup: { inline_keyboard: [[{ text: 'Buy Now', web_app: { url: `${url}/p/${r.productId}?startapp=restock_${r.productId}` } }]] } }),
  });
}
