import { Router } from 'express';
import { prisma } from '../db.js';

// Public catalog for the user storefront (no auth — same data the bot uses).
// Admin panel keeps using the authenticated /api/* routes.
export const publicRouter = Router();

publicRouter.get('/categories', async (_req, res) => {
  const cats = await prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  res.json({ categories: cats });
});

publicRouter.get('/products', async (req, res) => {
  const { categoryId = '', search = '' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = { isActive: true };
  if (categoryId) where.categoryId = String(categoryId);
  if (search) where.name = { contains: String(search), mode: 'insensitive' };
  const items = await prisma.product.findMany({
    where, orderBy: { sortOrder: 'asc' }, take: 100,
    include: { category: true, _count: { select: { stock: { where: { isSold: false } } } } },
  });
  res.json({
    products: items.map((p) => ({
      ...p,
      priceUsdt: Number(p.priceUsdt),
      stockCount: (p as never as { _count: { stock: number } })._count.stock,
    })),
  });
});

publicRouter.get('/products/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, include: { category: true } });
  if (!p || !p.isActive) return res.status(404).json({ error: 'not found' });
  const stockCount = await prisma.stockItem.count({ where: { productId: p.id, isSold: false } });
  res.json({ product: { ...p, priceUsdt: Number(p.priceUsdt), stockCount } });
});
