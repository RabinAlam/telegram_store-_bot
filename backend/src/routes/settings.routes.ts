import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { settingDto } from '../validators.js';

export const settingsRouter = Router();
const PUBLIC_SAFE = new Set(['supportUrl', 'channelUrl', 'referralPercent', 'minDeposit', 'manualAddresses', 'binanceUid']);
const SECRET_KEYS = new Set(['botToken', 'binanceSecret', 'binanceApiKey', 'binanceSpotApiKey', 'binanceSpotSecret']);

settingsRouter.get('/', requireAuth, async (_req, res) => {
  const all = await prisma.setting.findMany();
  const masked: Record<string, unknown> = {};
  for (const s of all) {
    if (SECRET_KEYS.has(s.key)) masked[s.key] = '••••••';
    else masked[s.key] = s.value;
  }
  res.json(masked);
});

settingsRouter.put('/', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = settingDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  if (SECRET_KEYS.has(p.data.key) && p.data.value === '••••••') return res.json({ ok: true }); // unchanged
  const before = await prisma.setting.findUnique({ where: { key: p.data.key } });
  await prisma.setting.upsert({ where: { key: p.data.key }, update: { value: p.data.value as object }, create: { key: p.data.key, value: p.data.value as object } });
  await audit((req as never as { adminId: string }).adminId, 'setting:update', 'setting', p.data.key, before?.value, p.data.value, req.ip ?? '');
  res.json({ ok: true });
});

settingsRouter.get('/public', async (_req, res) => {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...PUBLIC_SAFE] } } });
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
