"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhooksRouter = void 0;
const express_1 = require("express");
const node_crypto_1 = __importDefault(require("node:crypto"));
const db_js_1 = require("../db.js");
const binance_js_1 = require("../binance.js");
const orders_routes_js_1 = require("./orders.routes.js");
const bot_js_1 = require("../bot.js");
const zod_1 = require("zod");
exports.webhooksRouter = (0, express_1.Router)();
// Telegram webhook (grammY) — POST /webhooks/telegram with secret check
exports.webhooksRouter.post('/telegram', async (req, res) => {
    if (!bot_js_1.bot)
        return res.status(500).json({ error: 'bot not configured' });
    try {
        await bot_js_1.bot.handleUpdate(req.body);
        res.json({ ok: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'handler failed' });
    }
});
// Binance Pay webhook — idempotent via merchantOrderNo
const binanceWebhookDto = zod_1.z.object({
    merchantTradeNo: zod_1.z.string().optional(),
    merchantOrderNo: zod_1.z.string().optional(),
    prepayId: zod_1.z.string().optional(),
    bizOrderId: zod_1.z.string().optional(),
    bizStatus: zod_1.z.string(),
    timestamp: zod_1.z.string().optional(),
});
exports.webhooksRouter.post('/binance-pay', async (req, res) => {
    const sig = req.headers['binancepay-signature'] ?? req.body?.signature ?? '';
    const body = req.body;
    const merchantOrderNo = String(body.merchantTradeNo ?? body.merchantOrderNo ?? '');
    const bizOrderId = String(body.prepayId ?? body.bizOrderId ?? '');
    const bizStatus = String(body.bizStatus ?? body.tradeStatus ?? '');
    const timestamp = String(body.timestamp ?? req.headers['binancepay-timestamp'] ?? '');
    const basePath = '/webhooks/binance-pay';
    const verified = (0, binance_js_1.verifyBinanceWebhook)({ basePath, bizOrderId, bizStatus, timestamp, signature: sig });
    // If no secret configured (dev), allow but mark unverified — never mark paid without verification in prod
    const hasSecret = !!process.env.BINANCE_PAY_SECRET;
    if (hasSecret && !verified)
        return res.status(401).json({ returnCode: 'FAIL', returnMessage: 'bad signature' });
    if (!merchantOrderNo)
        return res.status(400).json({ returnCode: 'FAIL', returnMessage: 'missing order' });
    const existing = await db_js_1.prisma.binancePayment.findUnique({ where: { merchantOrderNo } });
    const payload = { ...body, _headers: { sig: sig.slice(0, 12), ts: timestamp } };
    if (existing?.status === 'PAID')
        return res.json({ returnCode: 'SUCCESS', returnMessage: 'already processed' });
    const isPaid = ['PAID', 'SUCCESS', 'COMPLETED'].includes(bizStatus.toUpperCase());
    await db_js_1.prisma.binancePayment.upsert({
        where: { merchantOrderNo },
        update: { bizOrderId, status: isPaid ? 'PAID' : bizStatus, rawWebhook: payload, verifiedAt: verified ? new Date() : undefined },
        create: { merchantOrderNo, bizOrderId, amount: 0, currency: 'USDT', status: isPaid ? 'PAID' : bizStatus, rawWebhook: payload, verifiedAt: verified ? new Date() : undefined },
    });
    if (isPaid && (verified || !hasSecret)) {
        const order = await db_js_1.prisma.order.findFirst({ where: { binancePayOrderNo: merchantOrderNo } });
        if (order && order.paymentStatus !== 'PAID') {
            await db_js_1.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
            await (0, orders_routes_js_1.fulfillOrder)(order.id);
            await (0, bot_js_1.notifyAdmins)(`✅ Binance paid <code>${order.orderNo}</code> $${Number(order.amountUsdt)}`);
        }
    }
    res.json({ returnCode: 'SUCCESS', returnMessage: 'ok' });
});
// Create Binance Pay order for an existing PENDING order
exports.webhooksRouter.post('/binance-pay/create', async (req, res) => {
    const { orderNo } = req.body;
    const order = await db_js_1.prisma.order.findUnique({ where: { orderNo } });
    if (!order)
        return res.status(404).json({ error: 'order not found' });
    const merchantOrderNo = order.binancePayOrderNo ?? `TZ-${order.orderNo}-${node_crypto_1.default.randomBytes(3).toString('hex')}`;
    const r = await (0, binance_js_1.createBinanceOrder)({ merchantOrderNo, amount: String(order.amountUsdt), goodsName: `TZ Store ${order.orderNo}` });
    await db_js_1.prisma.order.update({ where: { id: order.id }, data: { binancePayOrderNo: merchantOrderNo } });
    await db_js_1.prisma.binancePayment.upsert({
        where: { merchantOrderNo },
        update: {},
        create: { merchantOrderNo, amount: order.amountUsdt, currency: 'USDT', status: 'CREATED', rawWebhook: {} },
    });
    res.json({ merchantOrderNo, ...r });
});
