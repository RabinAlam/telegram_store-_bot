export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { vaultEncrypt } from '@/lib/vault-crypto';
import { requireAdminToken } from '@/lib/admin-auth';

// Delivery vault admin API (proxied by admin panel as /tz-api/admin/vault).
// GET ?productId= — rows with decrypted passwords (local admin only).
// POST { productId, login, password } — add one row.
// POST { productId, codes } — bulk import, one `login | password` per line.
// DELETE { id } — remove an AVAILABLE row.
export async function GET(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const productId = new URL(req.url).searchParams.get('productId') ?? '';
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
  return NextResponse.json({ rows: store.vaultList(productId), available: store.vaultAvailable(productId) });
}

export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({
    productId: z.string().min(1),
    login: z.string().max(200).optional(),
    password: z.string().max(500).optional(),
    codes: z.string().optional(),
  }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  if (p.data.codes) {
    const lines = p.data.codes.split('\n').map((s) => s.trim()).filter(Boolean);
    const rows = lines
      .map((line) => line.split(/\s*[|,;\t]\s*/))
      .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
      .map((parts) => ({ login: parts[0].trim(), passwordEnc: vaultEncrypt(parts.slice(1).join(' ').trim()) }));
    if (!rows.length) return NextResponse.json({ error: 'no valid rows — use one `login | password` per line' }, { status: 400 });
    const imported = store.vaultAdd(p.data.productId, rows);
    return NextResponse.json({ ok: true, imported, skipped: lines.length - rows.length }, { status: 201 });
  }
  if (!p.data.login || !p.data.password) return NextResponse.json({ error: 'login and password required' }, { status: 400 });
  const imported = store.vaultAdd(p.data.productId, [{ login: p.data.login.trim(), passwordEnc: vaultEncrypt(p.data.password) }]);
  return NextResponse.json({ ok: true, imported }, { status: 201 });
}

export async function DELETE(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = z.object({ id: z.string().min(1) }).safeParse(j);
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  try {
    store.vaultDelete(p.data.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete failed' }, { status: 400 });
  }
}
