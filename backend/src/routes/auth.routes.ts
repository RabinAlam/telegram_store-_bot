import { Router } from 'express';
import { prisma } from '../db.js';
import { loginDto, createAdminDto } from '../validators.js';
import { hashPassword, verifyPassword, signAccess, signRefresh, verifyRefresh, requireAuth, audit } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const p = loginDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  try {
    const admin = await prisma.admin.findUnique({ where: { email: p.data.email } });
    if (!admin) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await verifyPassword(p.data.password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }).catch(() => null);
    await audit(admin.id, 'login', 'admin', admin.id, null, { email: admin.email }, req.ip ?? '').catch(() => null);
    res.json({ accessToken: signAccess(admin.id, admin.role), refreshToken: signRefresh(admin.id), admin: { id: admin.id, email: admin.email, role: admin.role } });
  } catch {
    // Dev fallback when Postgres is down: allow seeded SUPER_ADMIN to log in
    if (p.data.email === 'admin@tzstore.io' && p.data.password === 'Admin@123') {
      const id = 'dev-admin-1';
      return res.json({ accessToken: signAccess(id, 'SUPER_ADMIN'), refreshToken: signRefresh(id), admin: { id, email: p.data.email, role: 'SUPER_ADMIN' } });
    }
    return res.status(401).json({ error: 'invalid credentials (DB offline)' });
  }
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: 'missing refresh token' });
  try {
    const p = verifyRefresh(refreshToken);
    if (p.sub === 'dev-admin-1') return res.json({ accessToken: signAccess('dev-admin-1', 'SUPER_ADMIN') });
    const admin = await prisma.admin.findUnique({ where: { id: p.sub } });
    if (!admin) return res.status(401).json({ error: 'invalid' });
    res.json({ accessToken: signAccess(admin.id, admin.role) });
  } catch { return res.status(401).json({ error: 'invalid refresh' }); }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const adminId = (req as never as { adminId: string }).adminId;
  if (adminId === 'dev-admin-1') return res.json({ id: 'dev-admin-1', email: 'admin@tzstore.io', role: 'SUPER_ADMIN' });
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) return res.status(404).json({ error: 'not found' });
  res.json({ id: admin.id, email: admin.email, role: admin.role });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const adminId = (req as never as { adminId: string }).adminId;
  const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'new password too short' });
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || !(await verifyPassword(oldPassword, admin.passwordHash))) return res.status(401).json({ error: 'wrong password' });
  await prisma.admin.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(newPassword) } });
  await audit(adminId, 'change-password', 'admin', adminId, null, null, req.ip ?? '');
  res.json({ ok: true });
});

export const adminsRouter = Router();
adminsRouter.get('/', requireAuth, async (_req, res) => {
  const list = await prisma.admin.findMany({ select: { id: true, email: true, role: true, lastLoginAt: true, createdAt: true } });
  res.json(list);
});
adminsRouter.post('/', requireAuth, async (req, res) => {
  const role = (req as never as { adminRole: string }).adminRole;
  if (role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'super admin only' });
  const p = createAdminDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const created = await prisma.admin.create({ data: { email: p.data.email, passwordHash: await hashPassword(p.data.password), role: p.data.role } });
  await audit((req as never as { adminId: string }).adminId, 'create', 'admin', created.id, null, { email: created.email, role: created.role }, req.ip ?? '');
  res.status(201).json({ id: created.id, email: created.email, role: created.role });
});
adminsRouter.delete('/:id', requireAuth, async (req, res) => {
  const role = (req as never as { adminRole: string }).adminRole;
  if (role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'super admin only' });
  const before = await prisma.admin.findUnique({ where: { id: req.params.id } });
  await prisma.admin.delete({ where: { id: req.params.id } });
  await audit((req as never as { adminId: string }).adminId, 'delete', 'admin', req.params.id, before, null, req.ip ?? '');
  res.json({ ok: true });
});
