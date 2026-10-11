export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json([]);

  try {
    const rows = await prisma.user.findMany({
      take: 50,
      orderBy: { referralEarnings: 'desc' },
      select: { telegramId: true, username: true, firstName: true, referralEarnings: true, referralCode: true },
    });
    return NextResponse.json(
      rows.map((r) => ({
        telegramId: r.telegramId.toString(),
        username: r.username ?? undefined,
        firstName: r.firstName ?? undefined,
        referralEarnings: Number(r.referralEarnings || 0),
        referralCode: r.referralCode,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}
