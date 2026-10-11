export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword, signAccess, signRefresh, audit } from '@/lib/admin-jwt';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 400 });
  }

  const prisma = db();
  if (!prisma) {
    return NextResponse.json({ error: 'database unavailable' }, { status: 503 });
  }

  try {
    const admin = await prisma.admin.findUnique({
      where: { email: parsed.data.email },
    });

    if (!admin) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
    }

    const isValid = await verifyPassword(parsed.data.password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => null);

    const clientIp = req.headers.get('x-forwarded-for') || '';
    await audit(admin.id, 'login', 'admin', admin.id, null, { email: admin.email }, clientIp).catch(() => null);

    const accessToken = signAccess(admin.id, admin.role);
    const refreshToken = signRefresh(admin.id);

    return NextResponse.json({
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (e: any) {
    console.error('Login error:', e);
    return NextResponse.json({ error: e?.message || 'service unavailable', name: e?.name }, { status: 500 });
  }
}
