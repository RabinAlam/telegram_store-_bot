import jwt from 'jsonwebtoken';
import { env } from './env';
export type Session = { tgId: string; username?: string; role: 'USER' | 'ADMIN' };
const ADMIN_IDS = new Set((process.env.ADMIN_TG_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
export function roleFor(tgId: string) { return ADMIN_IDS.has(String(tgId)) ? 'ADMIN' as const : 'USER' as const; }
export function signSession(s: Session) { return jwt.sign(s, env.JWT_SECRET, { expiresIn: env.JWT_TTL_SECONDS }); }
export function verifySession(token: string): Session | null {
  try { return jwt.verify(token, env.JWT_SECRET) as Session; } catch { return null; }
}
export function sessionFromRequest(req: Request): Session | null {
  const h = req.headers.get('authorization') ?? '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return null;
  return verifySession(m[1]);
}
