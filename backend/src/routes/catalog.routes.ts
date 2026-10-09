import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { categoryDto, productDto, stockImportDto, paginationDto } from '../validators.js';

export const catalogRouter = Router();

// --- Categories ---
catalogRouter.get('/categories', requireAuth, async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } }));
});
catalogRouter.post('/categories', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = categoryDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const c = await prisma.category.create({ data: p.data });
  await audit((req as never as { adminId: string }).adminId, 'create', 'category', c.id, null, c, req.ip ?? '');
  res.status(201).json(c);
});
catalogRouter.patch('/categories/:id', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = categoryDto.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  const c = await prisma.category.update({ where: { id: req.params.id }, data: p.data });
  await audit((req as never as { adminId: string }).adminId, 'update', 'category', c.id, before, c, req.ip ?? '');
  res.json(c);
});
catalogRouter.post('/categories/reorder', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds required' });
  await Promise.all(orderedIds.map((id, i) => prisma.category.update({ where: { id }, data: { sortOrder: i } })));
  res.json({ ok: true });
});
catalogRouter.delete('/categories/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const before = await prisma.category.findUnique({ where: { id: req.params.id } });
  await prisma.category.delete({ where: { id: req.params.id } });
  await audit((req as never as { adminId: string }).adminId, 'delete', 'category', req.params.id, before, null, req.ip ?? '');
  res.json({ ok: true });
});

// --- Products ---
catalogRouter.get('/products', requireAuth, async (req, res) => {
  const pg = paginationDto.parse(req.query);
  const { search = '', categoryId = '', isActive = '' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (search) where.OR = [{ name: { contains: String(search), mode: 'insensitive' } }];
  if (categoryId) where.categoryId = String(categoryId);
  if (isActive !== '') where.isActive = isActive === 'true';
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy: { sortOrder: 'asc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize,
      include: { category: true, _count: { select: { stock: { where: { isSold: false } } } } },
    }),
  ]);
  res.json({ total, page: pg.page, pageSize: pg.pageSize, items: items.map((p) => ({ ...p, stockCount: (p as never as { _count: { stock: number } })._count.stock })) });
});

catalogRouter.post('/products', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = productDto.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const created = await prisma.product.create({ data: { ...p.data, priceUsdt: p.data.priceUsdt } });
  await audit((req as never as { adminId: string }).adminId, 'create', 'product', created.id, null, created, req.ip ?? '');
  res.status(201).json(created);
});

catalogRouter.patch('/products/:id', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const p = productDto.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const before = await prisma.product.findUnique({ where: { id: req.params.id } });
  const updated = await prisma.product.update({ where: { id: req.params.id }, data: p.data });
  await audit((req as never as { adminId: string }).adminId, 'update', 'product', updated.id, before, updated, req.ip ?? '');
  res.json(updated);
});

catalogRouter.delete('/products/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const before = await prisma.product.findUnique({ where: { id: req.params.id } });
  await prisma.stockItem.deleteMany({ where: { productId: req.params.id, isSold: false } });
  await prisma.product.delete({ where: { id: req.params.id } });
  await audit((req as never as { adminId: string }).adminId, 'delete', 'product', req.params.id, before, null, req.ip ?? '');
  res.json({ ok: true });
});

catalogRouter.post('/products/:id/stock', requireAuth, requireRole('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
  const body = req.body as { text?: string; lines?: string[] };
  const lines = body.lines ?? String(body.text ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const p = stockImportDto.safeParse({ lines });
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  await prisma.stockItem.createMany({ data: p.data.lines.map((data) => ({ productId: req.params.id, data })) });
  const count = await prisma.stockItem.count({ where: { productId: req.params.id, isSold: false } });
  await audit((req as never as { adminId: string }).adminId, 'stock-import', 'product', req.params.id, null, { added: p.data.lines.length, count }, req.ip ?? '');
  res.json({ added: p.data.lines.length, stockCount: count });
});

catalogRouter.get('/products/:id/stock-count', requireAuth, async (req, res) => {
  const count = await prisma.stockItem.count({ where: { productId: req.params.id, isSold: false } });
  res.json({ count });
});
