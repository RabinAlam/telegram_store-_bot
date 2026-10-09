import { NextResponse } from 'next/server';
import { quoteSchema, quote } from '@/lib/pricing';
import { sharedProduct } from '@/lib/admin-api';
export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const p = quoteSchema.safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad qty' }, { status: 400 });
  try { return NextResponse.json(quote(p.data.productId, p.data.qty)); }
  catch {
    // Product may live in the shared admin backend, not the local seed
    const sp = await sharedProduct(p.data.productId);
    if (!sp) return NextResponse.json({ error: 'unknown product' }, { status: 400 });
    if (sp.stock <= 0) return NextResponse.json({ error: 'out of stock' }, { status: 400 });
    if (p.data.qty > sp.stock) return NextResponse.json({ error: 'not enough stock' }, { status: 400 });
    const total = Math.round(sp.priceUsdt * p.data.qty * 100) / 100;
    return NextResponse.json({ productId: sp.id, qty: p.data.qty, unitPrice: sp.priceUsdt, total, savings: 0 });
  }
}
