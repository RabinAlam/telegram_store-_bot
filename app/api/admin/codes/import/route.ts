import { NextResponse } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/store';
import { vaultEncrypt } from '@/lib/vault-crypto';
import { requireAdminToken } from '@/lib/admin-auth';

// Bulk account import: one `login | password` per line (comma/tab also accepted).
// Each row is AES-GCM encrypted into the delivery vault and counted as stock.
const schema = z.object({ productId: z.string(), codes: z.string().min(1) });

function parseLine(line: string): { login: string; password: string } | null {
  const parts = line.split(/\s*[|,;\t]\s*/);
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { login: parts[0].trim(), password: parts.slice(1).join(' ').trim() };
}

export async function POST(req: Request) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const j = await req.json().catch(() => ({}));
  const p = schema.safeParse(j);
  if (!p.success) return NextResponse.json({ error: 'bad' }, { status: 400 });
  const lines = p.data.codes.split('\n').map((s) => s.trim()).filter(Boolean);
  const parsed = lines.map(parseLine);
  const bad = lines.length - parsed.filter(Boolean).length;
  if (!parsed.filter(Boolean).length) {
    return NextResponse.json({ error: 'no valid rows — use one `login | password` per line' }, { status: 400 });
  }
  const rows = parsed.filter((r): r is { login: string; password: string } => !!r)
    .map((r) => ({ login: r.login, passwordEnc: vaultEncrypt(r.password) }));
  const imported = store.vaultAdd(p.data.productId, rows);
  return NextResponse.json({ ok: true, imported, skipped: bad });
}
