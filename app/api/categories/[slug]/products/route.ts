export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { sharedProductsBySlug } from '@/lib/admin-api';
export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const shared = await sharedProductsBySlug(params.slug);
  if (shared) return NextResponse.json({ products: shared, source: 'admin' });
  return NextResponse.json({ products: store.listProducts(params.slug), source: 'local' });
}
