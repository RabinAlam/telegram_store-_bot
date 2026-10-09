import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const p = z.object({ productId: z.string() }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  store.addNotif('dev-user', p.data.productId);
  return NextResponse.json({ ok: true });
}
