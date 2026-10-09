export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { requireAdminToken } from '@/lib/admin-auth';

export async function GET(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  return NextResponse.json({ categories: store.listCats(), source: 'tz-live' });
}

export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({ name: z.string().min(2).max(80) }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  try {
    const cat = store.addCategory(p.data.name);
    return NextResponse.json({ ok: true, category: cat }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'create failed' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({ orderedSlugs: z.array(z.string().min(1)).min(1).max(100) }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  store.reorderCats(p.data.orderedSlugs);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({ slug: z.string().min(1) }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  try {
    store.deleteCategory(p.data.slug);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete failed' }, { status: 400 });
  }
}
