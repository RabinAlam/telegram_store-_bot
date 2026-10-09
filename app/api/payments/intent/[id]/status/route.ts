export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const it = store.getIntent(params.id);
  if (!it) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (it.status === 'PENDING' && new Date(it.expiresAt).getTime() < Date.now()) {
    store.setIntent(it.id, { status: 'EXPIRED' });
    store.setOrderStatus(it.orderId, 'CANCELLED');
    return NextResponse.json({ intent: { ...it, status: 'EXPIRED' } });
  }
  return NextResponse.json({ intent: it });
}
