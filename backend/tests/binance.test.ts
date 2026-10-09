import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

function verifyBinanceWebhook(input: { basePath: string; bizOrderId: string; bizStatus: string; timestamp: string; signature: string }, secret: string) {
  const payload = `${input.basePath}${input.bizOrderId}${input.bizStatus}${input.timestamp}`;
  const expected = crypto.createHmac('sha512', secret).update(payload).digest('hex').toUpperCase();
  return expected === input.signature.toUpperCase();
}

describe('binance webhook verification', () => {
  it('accepts valid signature', () => {
    const secret = 's3cr3t';
    const base = { basePath: '/webhooks/binance-pay', bizOrderId: 'B123', bizStatus: 'PAID', timestamp: '1700000000000' };
    const sig = crypto.createHmac('sha512', secret).update(`${base.basePath}${base.bizOrderId}${base.bizStatus}${base.timestamp}`).digest('hex').toUpperCase();
    expect(verifyBinanceWebhook({ ...base, signature: sig }, secret)).toBe(true);
  });
  it('rejects tampered status', () => {
    const secret = 's3cr3t';
    const base = { basePath: '/webhooks/binance-pay', bizOrderId: 'B123', bizStatus: 'PAID', timestamp: '1700000000000' };
    const sig = crypto.createHmac('sha512', secret).update(`${base.basePath}${base.bizOrderId}${base.bizStatus}${base.timestamp}`).digest('hex').toUpperCase();
    expect(verifyBinanceWebhook({ ...base, bizStatus: 'FAILED', signature: sig }, secret)).toBe(false);
  });
});
