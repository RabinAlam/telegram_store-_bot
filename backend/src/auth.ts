import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './db.js';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }

export function signAccess(adminId: string, role: string) {
  return jwt.sign({ sub: adminId, role, typ: 'access' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TTL });
}
export function signRefresh(adminId: string) {
  return jwt.sign({ sub: adminId, typ: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL });
}
export function verifyAccess(token: string) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { sub: string; role: string };
}
export function verifyRefresh(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { sub: string };
}

export interface AuthedRequest extends Request { adminId?: string; adminRole?: string; }

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const p = verifyAccess(h.slice(7));
    req.adminId = p.sub; req.adminRole = p.role;
    next();
  } catch { return res.status(401).json({ error: 'invalid token' }); }
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.adminRole || !roles.includes(req.adminRole)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

export async function audit(adminId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown, ip: string) {
  await prisma.auditLog.create({ data: { adminId, action, entity, entityId, before: (before ?? {}) as object, after: (after ?? {}) as object, ip } });
}
