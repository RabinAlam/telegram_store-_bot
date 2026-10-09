export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { sessionFromRequest } from '@/lib/auth';
export async function GET(req: Request) {
  // Testing mode: owner from session when present, shared demo user otherwise.
  const s = sessionFromRequest(req);
  return NextResponse.json({ orders: store.myOrders(s?.tgId ?? 'dev-user') });
}
