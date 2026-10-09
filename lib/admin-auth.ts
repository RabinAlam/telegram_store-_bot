import { NextResponse } from 'next/server';

// Guards /api/admin/* : only callers with the shared ADMIN_API_TOKEN
// (admin panel server-side/vite proxy) can read vault passwords or mutate.
// Delivery credentials must ONLY reach the paying buyer (success page)
// and the admin panel — never the public internet.
export function requireAdminToken(req: Request): NextResponse | null {
  const expected = process.env.ADMIN_API_TOKEN ?? '';
  if (!expected) return NextResponse.json({ error: 'admin api not configured' }, { status: 503 });
  const got = req.headers.get('x-admin-token') ?? '';
  if (got !== expected) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}
