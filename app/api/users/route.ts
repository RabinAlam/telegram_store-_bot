export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json({ total: 0, items: [] });

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';

  const where: any = {};
  if (search) {
    if (/^\d+$/.test(search)) where.telegramId = BigInt(search);
    else where.username = { contains: search, mode: 'insensitive' };
  }

  try {
    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      total,
      items: items.map((u) => ({
        ...u,
        telegramId: u.telegramId ? u.telegramId.toString() : '',
        walletBalance: Number(u.walletBalance || 0),
        referralEarnings: Number(u.referralEarnings || 0),
      })),
    });
  } catch (e) {
    console.error('Users error:', e);
    return NextResponse.json({ total: 0, items: [] });
  }
}
