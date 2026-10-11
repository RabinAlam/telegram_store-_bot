export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAdminFromRequest, hashPassword, audit } from '@/lib/admin-jwt';

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'MANAGER', 'SUPPORT']).default('SUPPORT'),
});

export async function GET(req: Request) {
  const currentAdmin = await getAdminFromRequest(req);
  if (!currentAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'database unavailable' }, { status: 503 });

  const list = await prisma.admin.findMany({
    select: { id: true, email: true, role: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const currentAdmin = await getAdminFromRequest(req);
  if (!currentAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (currentAdmin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'super admin only' }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createAdminSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'database unavailable' }, { status: 503 });

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await prisma.admin.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
  });

  const clientIp = req.headers.get('x-forwarded-for') || '';
  await audit(currentAdmin.id, 'create', 'admin', created.id, null, { email: created.email, role: created.role }, clientIp);

  return NextResponse.json({ id: created.id, email: created.email, role: created.role }, { status: 201 });
}

export async function DELETE(req: Request) {
  const currentAdmin = await getAdminFromRequest(req);
  if (!currentAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (currentAdmin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'super admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'database unavailable' }, { status: 503 });

  const before = await prisma.admin.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await prisma.admin.delete({ where: { id } });

  const clientIp = req.headers.get('x-forwarded-for') || '';
  await audit(currentAdmin.id, 'delete', 'admin', id, before, null, clientIp);

  return NextResponse.json({ ok: true });
}
