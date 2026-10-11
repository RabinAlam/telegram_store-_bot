export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let it = store.getIntent(params.id);
  if (!it && !process.env.VITEST) {
    try {
      const { db } = await import('@/lib/db');
      const prisma = db();
      if (prisma) {
        const row = await prisma.setting.findUnique({ where: { key: `intent:${params.id}` } });
        if (row && row.value) {
          it = row.value as any;
          if (it) {
            try { store.createIntent(it); } catch {}
          }
        }
      }
    } catch {}
  }
  if (!it) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (it.status === 'PENDING' && new Date(it.expiresAt).getTime() < Date.now()) {
    store.setIntent(it.id, { status: 'EXPIRED' });
    store.setOrderStatus(it.orderId, 'CANCELLED');
    return NextResponse.json({ intent: { ...it, status: 'EXPIRED' } });
  }
  return NextResponse.json({ intent: it });
}

