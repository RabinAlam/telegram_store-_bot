export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json({ items: [] });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    const items = await prisma.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        admin: {
          select: { email: true },
        },
      },
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error('Audit GET error:', e);
    return NextResponse.json({ items: [] });
  }
}
