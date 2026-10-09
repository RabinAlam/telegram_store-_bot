export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
export async function GET() { return NextResponse.json({ restocks: store.restocks() }); }
