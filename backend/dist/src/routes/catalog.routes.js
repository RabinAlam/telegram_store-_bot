"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const validators_js_1 = require("../validators.js");
exports.catalogRouter = (0, express_1.Router)();
// --- Categories ---
exports.catalogRouter.get('/categories', auth_js_1.requireAuth, async (_req, res) => {
    res.json(await db_js_1.prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: true } } } }));
});
exports.catalogRouter.post('/categories', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.categoryDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const c = await db_js_1.prisma.category.create({ data: p.data });
    await (0, auth_js_1.audit)(req.adminId, 'create', 'category', c.id, null, c, req.ip ?? '');
    res.status(201).json(c);
});
exports.catalogRouter.patch('/categories/:id', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.categoryDto.partial().safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const before = await db_js_1.prisma.category.findUnique({ where: { id: req.params.id } });
    const c = await db_js_1.prisma.category.update({ where: { id: req.params.id }, data: p.data });
    await (0, auth_js_1.audit)(req.adminId, 'update', 'category', c.id, before, c, req.ip ?? '');
    res.json(c);
});
exports.catalogRouter.post('/categories/reorder', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds))
        return res.status(400).json({ error: 'orderedIds required' });
    await Promise.all(orderedIds.map((id, i) => db_js_1.prisma.category.update({ where: { id }, data: { sortOrder: i } })));
    res.json({ ok: true });
});
exports.catalogRouter.delete('/categories/:id', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const before = await db_js_1.prisma.category.findUnique({ where: { id: req.params.id } });
    await db_js_1.prisma.category.delete({ where: { id: req.params.id } });
    await (0, auth_js_1.audit)(req.adminId, 'delete', 'category', req.params.id, before, null, req.ip ?? '');
    res.json({ ok: true });
});
// --- Products ---
exports.catalogRouter.get('/products', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const { search = '', categoryId = '', isActive = '' } = req.query;
    const where = {};
    if (search)
        where.OR = [{ name: { contains: String(search), mode: 'insensitive' } }];
    if (categoryId)
        where.categoryId = String(categoryId);
    if (isActive !== '')
        where.isActive = isActive === 'true';
    const [total, items] = await Promise.all([
        db_js_1.prisma.product.count({ where }),
        db_js_1.prisma.product.findMany({
            where, orderBy: { sortOrder: 'asc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize,
            include: { category: true, _count: { select: { stock: { where: { isSold: false } } } } },
        }),
    ]);
    res.json({ total, page: pg.page, pageSize: pg.pageSize, items: items.map((p) => ({ ...p, stockCount: p._count.stock })) });
});
exports.catalogRouter.post('/products', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.productDto.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const created = await db_js_1.prisma.product.create({ data: { ...p.data, priceUsdt: p.data.priceUsdt } });
    await (0, auth_js_1.audit)(req.adminId, 'create', 'product', created.id, null, created, req.ip ?? '');
    res.status(201).json(created);
});
exports.catalogRouter.patch('/products/:id', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const p = validators_js_1.productDto.partial().safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    const before = await db_js_1.prisma.product.findUnique({ where: { id: req.params.id } });
    const updated = await db_js_1.prisma.product.update({ where: { id: req.params.id }, data: p.data });
    await (0, auth_js_1.audit)(req.adminId, 'update', 'product', updated.id, before, updated, req.ip ?? '');
    res.json(updated);
});
exports.catalogRouter.delete('/products/:id', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN'), async (req, res) => {
    const before = await db_js_1.prisma.product.findUnique({ where: { id: req.params.id } });
    await db_js_1.prisma.stockItem.deleteMany({ where: { productId: req.params.id, isSold: false } });
    await db_js_1.prisma.product.delete({ where: { id: req.params.id } });
    await (0, auth_js_1.audit)(req.adminId, 'delete', 'product', req.params.id, before, null, req.ip ?? '');
    res.json({ ok: true });
});
exports.catalogRouter.post('/products/:id/stock', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const body = req.body;
    const lines = body.lines ?? String(body.text ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    const p = validators_js_1.stockImportDto.safeParse({ lines });
    if (!p.success)
        return res.status(400).json({ error: p.error.flatten() });
    await db_js_1.prisma.stockItem.createMany({ data: p.data.lines.map((data) => ({ productId: req.params.id, data })) });
    const count = await db_js_1.prisma.stockItem.count({ where: { productId: req.params.id, isSold: false } });
    await (0, auth_js_1.audit)(req.adminId, 'stock-import', 'product', req.params.id, null, { added: p.data.lines.length, count }, req.ip ?? '');
    res.json({ added: p.data.lines.length, stockCount: count });
});
exports.catalogRouter.get('/products/:id/stock-count', auth_js_1.requireAuth, async (req, res) => {
    const count = await db_js_1.prisma.stockItem.count({ where: { productId: req.params.id, isSold: false } });
    res.json({ count });
});
