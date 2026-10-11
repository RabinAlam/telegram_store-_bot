export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest, audit } from '@/lib/admin-jwt';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const currentAdmin = await getAdminFromRequest(req);
  if (!currentAdmin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (currentAdmin.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'super admin only' }, { status: 403 });
  }

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'database unavailable' }, { status: 503 });

  const before = await prisma.admin.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await prisma.admin.delete({ where: { id: params.id } });

  const clientIp = req.headers.get('x-forwarded-for') || '';
  await audit(currentAdmin.id, 'delete', 'admin', params.id, before, null, clientIp);

  return NextResponse.json({ ok: true });
}
