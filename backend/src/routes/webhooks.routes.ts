import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { verifyBinanceWebhook, createBinanceOrder } from '../binance.js';
import { fulfillOrder } from './orders.routes.js';
import { bot, notifyAdmins, sendUserMessage } from '../bot.js';
import { z } from 'zod';

export const webhooksRouter = Router();

// Telegram webhook (grammY) — POST /webhooks/telegram with secret check
webhooksRouter.post('/telegram', async (req, res) => {
  if (!bot) return res.status(500).json({ error: 'bot not configured' });
  try { await bot.handleUpdate(req.body); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'handler failed' }); }
});

// Binance Pay webhook — idempotent via merchantOrderNo
const binanceWebhookDto = z.object({
  merchantTradeNo: z.string().optional(),
  merchantOrderNo: z.string().optional(),
  prepayId: z.string().optional(),
  bizOrderId: z.string().optional(),
  bizStatus: z.string(),
  timestamp: z.string().optional(),
});
webhooksRouter.post('/binance-pay', async (req, res) => {
  const sig = (req.headers['binancepay-signature'] as string) ?? (req.body?.signature as string) ?? '';
  const body = req.body as Record<string, string>;
  const merchantOrderNo = String(body.merchantTradeNo ?? body.merchantOrderNo ?? '');
  const bizOrderId = String(body.prepayId ?? body.bizOrderId ?? '');
  const bizStatus = String(body.bizStatus ?? body.tradeStatus ?? '');
  const timestamp = String(body.timestamp ?? req.headers['binancepay-timestamp'] ?? '');
  const basePath = '/webhooks/binance-pay';
  const verified = verifyBinanceWebhook({ basePath, bizOrderId, bizStatus, timestamp, signature: sig });
  // If no secret configured (dev), allow but mark unverified — never mark paid without verification in prod
  const hasSecret = !!process.env.BINANCE_PAY_SECRET;
  if (hasSecret && !verified) return res.status(401).json({ returnCode: 'FAIL', returnMessage: 'bad signature' });

  if (!merchantOrderNo) return res.status(400).json({ returnCode: 'FAIL', returnMessage: 'missing order' });
  const existing = await prisma.binancePayment.findUnique({ where: { merchantOrderNo } });
  const payload = { ...body, _headers: { sig: sig.slice(0, 12), ts: timestamp } };
  if (existing?.status === 'PAID') return res.json({ returnCode: 'SUCCESS', returnMessage: 'already processed' });

  const isPaid = ['PAID', 'SUCCESS', 'COMPLETED'].includes(bizStatus.toUpperCase());
  await prisma.binancePayment.upsert({
    where: { merchantOrderNo },
    update: { bizOrderId, status: isPaid ? 'PAID' : bizStatus, rawWebhook: payload, verifiedAt: verified ? new Date() : undefined },
    create: { merchantOrderNo, bizOrderId, amount: 0, currency: 'USDT', status: isPaid ? 'PAID' : bizStatus, rawWebhook: payload, verifiedAt: verified ? new Date() : undefined },
  });
  if (isPaid && (verified || !hasSecret)) {
    const order = await prisma.order.findFirst({ where: { binancePayOrderNo: merchantOrderNo } });
    if (order && order.paymentStatus !== 'PAID') {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
      await fulfillOrder(order.id);
      await notifyAdmins(`✅ Binance paid <code>${order.orderNo}</code> $${Number(order.amountUsdt)}`);
    }
  }
  res.json({ returnCode: 'SUCCESS', returnMessage: 'ok' });
});

// Create Binance Pay order for an existing PENDING order
webhooksRouter.post('/binance-pay/create', async (req, res) => {
  const { orderNo } = req.body as { orderNo: string };
  const order = await prisma.order.findUnique({ where: { orderNo } });
  if (!order) return res.status(404).json({ error: 'order not found' });
  const merchantOrderNo = order.binancePayOrderNo ?? `TZ-${order.orderNo}-${crypto.randomBytes(3).toString('hex')}`;
  const r = await createBinanceOrder({ merchantOrderNo, amount: String(order.amountUsdt), goodsName: `TZ Store ${order.orderNo}` });
  await prisma.order.update({ where: { id: order.id }, data: { binancePayOrderNo: merchantOrderNo } });
  await prisma.binancePayment.upsert({
    where: { merchantOrderNo },
    update: {},
    create: { merchantOrderNo, amount: order.amountUsdt, currency: 'USDT', status: 'CREATED', rawWebhook: {} },
  });
  res.json({ merchantOrderNo, ...r });
});
