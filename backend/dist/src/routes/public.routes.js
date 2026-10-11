"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
// Public catalog for the user storefront (no auth — same data the bot uses).
// Admin panel keeps using the authenticated /api/* routes.
exports.publicRouter = (0, express_1.Router)();
exports.publicRouter.get('/categories', async (_req, res) => {
    const cats = await db_js_1.prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    res.json({ categories: cats });
});
exports.publicRouter.get('/products', async (req, res) => {
    const { categoryId = '', search = '' } = req.query;
    const where = { isActive: true };
    if (categoryId)
        where.categoryId = String(categoryId);
    if (search)
        where.name = { contains: String(search), mode: 'insensitive' };
    const items = await db_js_1.prisma.product.findMany({
        where, orderBy: { sortOrder: 'asc' }, take: 100,
        include: { category: true, _count: { select: { stock: { where: { isSold: false } } } } },
    });
    res.json({
        products: items.map((p) => ({
            ...p,
            priceUsdt: Number(p.priceUsdt),
            stockCount: p._count.stock,
        })),
    });
});
exports.publicRouter.get('/products/:id', async (req, res) => {
    const p = await db_js_1.prisma.product.findUnique({ where: { id: req.params.id }, include: { category: true } });
    if (!p || !p.isActive)
        return res.status(404).json({ error: 'not found' });
    const stockCount = await db_js_1.prisma.stockItem.count({ where: { productId: p.id, isSold: false } });
    res.json({ product: { ...p, priceUsdt: Number(p.priceUsdt), stockCount } });
});
exports.publicRouter.post('/orders', async (req, res) => {
    const { orderNo, userTelegramId, productId, qty, paymentMethod = 'BINANCE_PAY' } = req.body;
    const quantity = Math.max(1, Math.floor(Number(qty) || 1));
    if (!orderNo || !productId)
        return res.status(400).json({ error: 'missing required fields' });
    try {
        const product = await db_js_1.prisma.product.findUnique({ where: { id: productId } });
        if (!product || !product.isActive)
            return res.status(404).json({ error: 'product not available' });
        // Server-side authoritative price calculation (anti-tampering)
        const totalAmount = Math.round(Number(product.priceUsdt) * quantity * 100) / 100;
        const tgId = BigInt(userTelegramId && /^\d+$/.test(userTelegramId) ? userTelegramId : 0);
        const effectiveUserId = tgId > 0n ? tgId : 9999999999n;
        await db_js_1.prisma.user.upsert({
            where: { telegramId: effectiveUserId },
            update: {},
            create: { telegramId: effectiveUserId, referralCode: `TZ${effectiveUserId}${Math.floor(Math.random() * 900 + 100)}` },
        }).catch(() => null);
        const order = await db_js_1.prisma.order.create({
            data: {
                orderNo,
                userId: effectiveUserId,
                productId,
                qty: quantity,
                amountUsdt: totalAmount,
                paymentMethod: paymentMethod,
                paymentStatus: 'PENDING',
            },
        });
        res.status(201).json({ ok: true, orderId: order.id, orderNo: order.orderNo, amountUsdt: totalAmount });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'failed to create order' });
    }
});
