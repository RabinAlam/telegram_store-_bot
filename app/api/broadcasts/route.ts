export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAdminFromRequest, audit } from '@/lib/admin-jwt';

const createBroadcastSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  targetType: z.enum(['ALL', 'SEGMENT']).default('ALL'),
});

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const prisma = db();
  if (!prisma) return NextResponse.json([]);

  try {
    const list = await prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return NextResponse.json(list);
  } catch (e) {
    console.error('Broadcast GET error:', e);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'MANAGER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createBroadcastSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = db();
  if (!prisma) return NextResponse.json({ error: 'database unavailable' }, { status: 503 });

  try {
    const b = await prisma.broadcast.create({
      data: {
        title: parsed.data.title,
        text: parsed.data.text,
        targetType: parsed.data.targetType,
        status: 'DRAFT',
      },
    });

    const clientIp = req.headers.get('x-forwarded-for') || '';
    await audit(admin.id, 'create', 'broadcast', b.id, null, b, clientIp);

    return NextResponse.json(b, { status: 201 });
  } catch (e) {
    console.error('Broadcast create error:', e);
    return NextResponse.json({ error: 'failed to create broadcast' }, { status: 500 });
  }
}
