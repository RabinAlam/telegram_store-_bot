import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-32-chars-minimum-123';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-32-chars-minimum-456';

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signAccess(adminId: string, role: string) {
  return jwt.sign({ sub: adminId, role, typ: 'access' }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefresh(adminId: string) {
  return jwt.sign({ sub: adminId, typ: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccess(token: string) {
  const p = jwt.verify(token, ACCESS_SECRET) as { sub: string; role: string; typ?: string };
  if (p.typ && p.typ !== 'access') throw new Error('invalid token type');
  return p;
}

export function verifyRefresh(token: string) {
  const p = jwt.verify(token, REFRESH_SECRET) as { sub: string; typ?: string };
  if (p.typ && p.typ !== 'refresh') throw new Error('invalid token type');
  return p;
}

export async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = verifyAccess(authHeader.slice(7));
    const prisma = db();
    if (!prisma) return null;
    const admin = await prisma.admin.findUnique({ where: { id: payload.sub } });
    return admin;
  } catch {
    return null;
  }
}

export async function audit(
  adminId: string,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  ip: string
) {
  try {
    const prisma = db();
    if (!prisma) return;
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        before: (before ?? {}) as object,
        after: (after ?? {}) as object,
        ip: ip || '',
      },
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
