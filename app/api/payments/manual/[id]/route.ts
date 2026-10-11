export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { getAdminFromRequest, audit } from '@/lib/admin-jwt';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const approve = Boolean(json?.approve);

  try {
    const nextStatus = approve ? 'DELIVERED' : 'CANCELLED';
    store.setOrderStatus(params.id, nextStatus);
    const clientIp = req.headers.get('x-forwarded-for') || '';
    await audit(admin.id, approve ? 'approve' : 'reject', 'payment', params.id, null, { approve }, clientIp);
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'action failed' }, { status: 400 });
  }
}
