export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return NextResponse.json({ total: 0, items: [] });
}
