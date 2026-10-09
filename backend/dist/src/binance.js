"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signBinancePay = signBinancePay;
exports.createBinanceOrder = createBinanceOrder;
exports.verifyBinanceWebhook = verifyBinanceWebhook;
const node_crypto_1 = __importDefault(require("node:crypto"));
// Binance Pay v3 headers: BinancePay-Timestamp, BinancePay-Nonce, BinancePay-Certificate-SN (api key), BinancePay-Signature
// Signature = HMAC-SHA512(timestamp + "\n" + nonce + "\n" + body + "\n", secret).toUpperCase hex
function signBinancePay(timestamp, nonce, body, secret) {
    const payload = `${timestamp}\n${nonce}\n${body}\n`;
    return node_crypto_1.default.createHmac('sha512', secret).update(payload).digest('hex').toUpperCase();
}
async function createBinanceOrder(opts) {
    const merchantId = process.env.BINANCE_PAY_MERCHANT_ID ?? '';
    const apiKey = process.env.BINANCE_PAY_API_KEY ?? '';
    const secret = process.env.BINANCE_PAY_SECRET ?? '';
    const sandbox = (process.env.BINANCE_PAY_SANDBOX ?? 'true') !== 'false';
    const base = sandbox ? 'https://bpay.binanceapi.com' : 'https://bpay.binanceapi.com';
    const body = JSON.stringify({
        env: { terminalType: 'WEB' },
        merchantTradeNo: opts.merchantOrderNo,
        orderAmount: Number(opts.amount),
        currency: opts.currency ?? 'USDT',
        goods: { goodsType: '02', goodsCategory: 'Z000', referenceGoodsId: opts.merchantOrderNo, goodsName: opts.goodsName ?? 'TZ Store order', goodsDetail: 'Digital goods' },
        ...(opts.returnUrl ? { returnUrl: opts.returnUrl } : {}),
    });
    const timestamp = String(Date.now());
    const nonce = node_crypto_1.default.randomBytes(16).toString('hex');
    if (!apiKey || !secret) {
        // No keys configured: return a mock checkout so admin flow still works
        return { checkoutUrl: '', bizOrderId: '', mocked: true, requestBody: body };
    }
    const signature = signBinancePay(timestamp, nonce, body, secret);
    const r = await fetch(`${base}/binancepay/openapi/v3/order`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'BinancePay-Timestamp': timestamp,
            'BinancePay-Nonce': nonce,
            'BinancePay-Certificate-SN': apiKey,
            'BinancePay-Signature': signature,
        },
        body,
    });
    const j = (await r.json());
    if (j.status !== 'SUCCESS')
        throw new Error(`Binance create failed: ${j.errorMessage ?? JSON.stringify(j)}`);
    void merchantId;
    return { checkoutUrl: j.data?.checkoutUrl ?? '', bizOrderId: j.data?.prepayId ?? '', mocked: false, requestBody: body };
}
// Webhook verification per spec: HMAC-SHA512 of basePath+bizOrderId+bizStatus+timestamp with SecretKey
// Binance actually signs webhook body; we implement the spec'd scheme + constant-time compare.
function verifyBinanceWebhook(input) {
    const secret = process.env.BINANCE_PAY_SECRET ?? '';
    if (!secret)
        return false;
    const payload = `${input.basePath}${input.bizOrderId}${input.bizStatus}${input.timestamp}`;
    const expected = node_crypto_1.default.createHmac('sha512', secret).update(payload).digest('hex').toUpperCase();
    const a = Buffer.from(expected);
    const b = Buffer.from((input.signature ?? '').toUpperCase());
    if (a.length !== b.length)
        return false;
    return node_crypto_1.default.timingSafeEqual(a, b);
}
