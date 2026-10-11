export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRefresh, signAccess } from '@/lib/admin-jwt';

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const refreshToken = json?.refreshToken;
  if (!refreshToken) {
    return NextResponse.json({ error: 'missing refresh token' }, { status: 400 });
  }

  try {
    const payload = verifyRefresh(refreshToken);
    const prisma = db();
    if (!prisma) {
      return NextResponse.json({ error: 'database unavailable' }, { status: 503 });
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.sub } });
    if (!admin) {
      return NextResponse.json({ error: 'invalid' }, { status: 401 });
    }

    return NextResponse.json({
      accessToken: signAccess(admin.id, admin.role),
    });
  } catch {
    return NextResponse.json({ error: 'invalid refresh token' }, { status: 401 });
  }
}
