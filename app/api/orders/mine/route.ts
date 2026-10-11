export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { sessionFromRequest } from '@/lib/auth';
import { sharedOrdersByUser } from '@/lib/admin-api';

export async function GET(req: Request) {
  const s = sessionFromRequest(req);
  const userTg = s?.tgId ?? 'dev-user';
  const localOrders = store.myOrders(userTg);
  const dbOrders = await sharedOrdersByUser(userTg).catch(() => null);

  const seen = new Set<string>();
  const merged: any[] = [];

  for (const o of localOrders) {
    if (!seen.has(o.id)) {
      seen.add(o.id);
      merged.push(o);
    }
  }

  if (dbOrders) {
    for (const o of dbOrders) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        merged.push(o);
      }
    }
  }

  return NextResponse.json({ orders: merged });
}

