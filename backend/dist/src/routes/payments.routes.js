"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const bot_js_1 = require("../bot.js");
const orders_routes_js_1 = require("./orders.routes.js");
const validators_js_1 = require("../validators.js");
exports.paymentsRouter = (0, express_1.Router)();
exports.paymentsRouter.get('/binance', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const [total, items] = await Promise.all([
        db_js_1.prisma.binancePayment.count(),
        db_js_1.prisma.binancePayment.findMany({ orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize }),
    ]);
    res.json({ total, items });
});
// Manual deposits queue = orders with MANUAL_CRYPTO + PENDING (txid present)
exports.paymentsRouter.get('/manual', auth_js_1.requireAuth, async (req, res) => {
    const pg = validators_js_1.paginationDto.parse(req.query);
    const where = { paymentMethod: 'MANUAL_CRYPTO', paymentStatus: 'PENDING' };
    const [total, items] = await Promise.all([
        db_js_1.prisma.order.count({ where }),
        db_js_1.prisma.order.findMany({
            where, orderBy: { createdAt: 'desc' }, skip: (pg.page - 1) * pg.pageSize, take: pg.pageSize,
            include: { user: { select: { telegramId: true, username: true, firstName: true } }, product: { select: { name: true } } },
        }),
    ]);
    res.json({ total, items: items.map((o) => ({ ...o, userId: o.userId.toString(), user: { ...o.user, telegramId: o.user.telegramId.toString() } })) });
});
exports.paymentsRouter.post('/manual/:orderId', auth_js_1.requireAuth, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'MANAGER'), async (req, res) => {
    const { approve, note = '' } = req.body;
    const adminId = req.adminId;
    const order = await db_js_1.prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order)
        return res.status(404).json({ error: 'not found' });
    if (order.paymentStatus !== 'PENDING')
        return res.status(400).json({ error: 'already decided' });
    if (approve) {
        // Manual crypto here acts as wallet top-up OR order payment: if product is wallet-topup pseudo, credit wallet; else mark paid+fulfill.
        // Spec: approve credits wallet, writes WalletTransaction + AuditLog, notifies user.
        await db_js_1.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
        // If order amount is a deposit (product name contains deposit) credit wallet directly, else fulfill product order
        const { fulfillOrder } = await Promise.resolve().then(() => __importStar(require('./orders.routes.js')));
        await fulfillOrder(order.id);
        await creditWalletIfDeposit(order, adminId, note);
        await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `✅ Manual deposit <code>${order.orderNo}</code> approved. TXID: <code>${order.txid ?? '—'}</code> ${note}`);
    }
    else {
        await db_js_1.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
        await (0, bot_js_1.sendUserMessage)(order.userId.toString(), `❌ Manual deposit <code>${order.orderNo}</code> rejected. ${note} Contact support.`);
    }
    await (0, auth_js_1.audit)(adminId, approve ? 'deposit:approve' : 'deposit:reject', 'order', order.id, { status: 'PENDING' }, { status: approve ? 'PAID' : 'FAILED', note }, req.ip ?? '');
    await (0, bot_js_1.notifyAdmins)(`💰 Manual deposit <code>${order.orderNo}</code> ${approve ? 'approved' : 'rejected'}`);
    res.json({ ok: true });
});
async function creditWalletIfDeposit(order, adminId, note) {
    // For pure wallet top-up orders (product name starts with "Wallet"), also credit wallet.
    const full = await db_js_1.prisma.order.findUnique({ where: { orderNo: order.orderNo }, include: { product: true } });
    if (full && /wallet|deposit/i.test(full.product.name)) {
        await (0, orders_routes_js_1.creditWallet)(order.userId, String(full.amountUsdt), `Manual deposit ${order.orderNo} ${note}`, full.id, adminId);
    }
}
