export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fulfillOrder } from '@/lib/fulfill';
import { requireAdminToken } from '@/lib/admin-auth';

// Manual admin fulfill for NEEDS_REVIEW orders (e.g. vault was empty at payment time
// and admin stocked it afterwards, or delivery was arranged manually).
export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({ orderId: z.string().min(1) }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  try {
    const r = await fulfillOrder(p.data.orderId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'fulfill failed' }, { status: 400 });
  }
}
