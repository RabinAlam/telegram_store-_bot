import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateInitData } from '@/lib/telegram';
import { signSession, roleFor } from '@/lib/auth';
const body = z.object({ initData: z.string().min(1) });
export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const p = body.safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const token = process.env.BOT_TOKEN ?? '';
  if (!token) {
    // Dev fallback: accept unsigned initData so UI can be built without a bot token.
    return NextResponse.json({ token: 'dev', dev: true });
  }
  const v = validateInitData(p.data.initData, token, 86400);
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 401 });
  const tgId = String(v.user?.id ?? '0');
  const jwt = signSession({ tgId, username: v.user?.username, role: roleFor(tgId) });
  return NextResponse.json({ token: jwt });
}
