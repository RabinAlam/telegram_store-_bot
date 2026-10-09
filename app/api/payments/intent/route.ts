import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { sessionFromRequest } from '@/lib/auth';
import { newId, starsFor, demoAddress, createStarsInvoiceLink, type Provider } from '@/lib/payments';
import { flags } from '@/lib/env';
const schema = z.object({ orderId: z.string(), provider: z.enum(['STARS', 'BINANCE', 'TRC20', 'BEP20', 'BTC']), binanceUid: z.string().optional() });
const enabled: Record<Provider, boolean> = { STARS: flags.stars, BINANCE: flags.binance, TRC20: flags.trc20, BEP20: flags.bep20, BTC: flags.btc };
export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const p = schema.safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  if (!enabled[p.data.provider]) return NextResponse.json({ error: 'provider disabled' }, { status: 400 });
  const order = store.getOrder(p.data.orderId);
  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 });
  if (order.status !== 'PENDING') return NextResponse.json({ error: 'order not payable' }, { status: 400 });
  const id = newId('in');
  const expiresAt = new Date(Date.now() + 20 * 60_000).toISOString();
  if (p.data.provider === 'STARS') {
    const stars = starsFor(order.total);
    const link = await createStarsInvoiceLink(`TZ Store ${order.productId} x${order.qty}`, id, stars).catch(() => `https://t.me/invoice/dev_${id}`);
    const intent = store.createIntent({ id, orderId: order.id, provider: 'STARS', asset: 'XTR', amount: stars, memo: id, status: 'PENDING', expiresAt });
    return NextResponse.json({ intent, invoiceLink: link, stars });
  }
  if (p.data.provider === 'BINANCE') {
    if (!p.data.binanceUid) return NextResponse.json({ error: 'Binance UID required' }, { status: 400 });
    const intent = store.createIntent({ id, orderId: order.id, provider: 'BINANCE', asset: 'BINANCE-UID', amount: order.total, address: p.data.binanceUid, memo: id, status: 'PENDING', expiresAt });
    return NextResponse.json({ intent, note: 'Transfer to store UID then press confirm. Auto-match requires BINANCE_PAY_API_KEY, else manual review.' });
  }
  const asset = p.data.provider === 'TRC20' ? 'USDT-TRC20' : p.data.provider === 'BEP20' ? 'USDT-BEP20' : 'BTC';
  const intent = store.createIntent({ id, orderId: order.id, provider: p.data.provider, asset, amount: order.total, address: demoAddress(p.data.provider, id), memo: id, status: 'PENDING', expiresAt });
  return NextResponse.json({ intent });
}
