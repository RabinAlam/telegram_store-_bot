import { NextResponse } from 'next/server';
import { verifyAccess } from './admin-jwt';

// Guards /api/admin/* : callers with either:
// 1. Shared ADMIN_API_TOKEN in 'x-admin-token'
// 2. Valid Admin JWT in 'Authorization: Bearer <token>'
export function requireAdminToken(req: Request): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccess(authHeader.slice(7));
      if (payload.sub) return null; // Authenticated via Admin JWT
    } catch {
      // Fall through to check x-admin-token
    }
  }

  const expected = process.env.ADMIN_API_TOKEN ?? '';
  const got = req.headers.get('x-admin-token') ?? '';
  if (expected && got === expected) {
    return null; // Authenticated via shared token
  }

  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
