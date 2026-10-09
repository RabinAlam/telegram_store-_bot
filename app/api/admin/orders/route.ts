export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { requireAdminToken } from '@/lib/admin-auth';
export async function GET(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const orders = store.allOrders().reverse().slice(0, 100);
  const intents = store.allIntents().reverse().slice(0, 100);
  const revenue = store.allOrders().filter((o: any) => ['PAID', 'DELIVERED'].includes(o.status)).reduce((s: number, o: any) => s + Number(o.total), 0);
  return NextResponse.json({ orders, intents, revenue: Math.round(revenue * 100) / 100 });
}
