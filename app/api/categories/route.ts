export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { sharedCategories } from '@/lib/admin-api';
export async function GET() {
  const shared = await sharedCategories();
  if (shared) return NextResponse.json({ categories: shared, source: 'admin' });
  return NextResponse.json({ categories: store.listCats(), source: 'local' });
}
