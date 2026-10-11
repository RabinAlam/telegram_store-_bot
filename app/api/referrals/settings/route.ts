export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminFromRequest, audit } from '@/lib/admin-jwt';

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json({ percent: 5 });

  try {
    const s = await prisma.setting.findUnique({ where: { key: 'referralPercent' } });
    return NextResponse.json({ percent: Number((s?.value as number) ?? 5) });
  } catch {
    return NextResponse.json({ percent: 5 });
  }
}

export async function PUT(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'MANAGER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const percent = Number(json?.percent);
  if (isNaN(percent) || percent < 0 || percent > 50) {
    return NextResponse.json({ error: 'percent must be between 0 and 50' }, { status: 400 });
  }

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'database unavailable' }, { status: 503 });

  try {
    const before = await prisma.setting.findUnique({ where: { key: 'referralPercent' } });
    await prisma.setting.upsert({
      where: { key: 'referralPercent' },
      update: { value: percent },
      create: { key: 'referralPercent', value: percent },
    });

    const clientIp = req.headers.get('x-forwarded-for') || '';
    await audit(admin.id, 'referral:setting', 'setting', 'referralPercent', before?.value, percent, clientIp);

    return NextResponse.json({ ok: true, percent });
  } catch (e) {
    console.error('Referral setting error:', e);
    return NextResponse.json({ error: 'failed to update' }, { status: 500 });
  }
}
