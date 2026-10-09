export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdminToken } from '@/lib/admin-auth';

// Product photo upload: client sends { filename, dataUrl } (data:image/...;base64,...).
// Saved to public/uploads/<safe-name>, returns { url } used as product logo.
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const { filename = 'photo.png', dataUrl = '' } = j as { filename?: string; dataUrl?: string };
  const m = /^data:(image\/(png|jpe?g|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) return NextResponse.json({ error: 'send dataUrl data:image/png|jpeg|webp|gif|svg;base64,...' }, { status: 400 });
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: 'image must be 1B–2MB' }, { status: 400 });
  const ext = m[1].includes('png') ? 'png' : m[1].includes('webp') ? 'webp' : m[1].includes('gif') ? 'gif' : m[1].includes('svg') ? 'svg' : 'jpg';
  const base = String(filename).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9._-]+/g, '-').slice(-40) || 'photo';
  const safe = `${Date.now().toString(36)}-${base}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safe), buf);
  return NextResponse.json({ ok: true, url: `/uploads/${safe}` });
}
