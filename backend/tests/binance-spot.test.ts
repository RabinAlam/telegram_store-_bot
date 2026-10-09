import { describe, it, expect } from 'vitest';
import { signSpot, matchDeposit } from '../src/binance-spot.js';

describe('spot api signature', () => {
  it('produces 64-char lowercase hex HMAC-SHA256', () => {
    const sig = signSpot('coin=USDT&timestamp=1700000000000&recvWindow=10000', 'testsecret');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is deterministic and key-sensitive', () => {
    const q = 'coin=USDT&timestamp=1&recvWindow=10000';
    expect(signSpot(q, 'a')).toBe(signSpot(q, 'a'));
    expect(signSpot(q, 'a')).not.toBe(signSpot(q, 'b'));
  });
});

const deposits = [
  { amount: '10.00', coin: 'USDT', txId: 'abc123def', status: 1 },
  { amount: '25.50', coin: 'USDT', txId: 'xyz789', status: 1 },
  { amount: '10.00', coin: 'USDT', txId: 'other999', status: 0 }, // failed -> ignored
];

describe('matchDeposit', () => {
  it('matches amount + txid', () => {
    const m = matchDeposit(deposits, { amount: 10, txid: 'abc123def' });
    expect(m.matched).toBe(true);
  });
  it('rejects wrong txid', () => {
    const m = matchDeposit(deposits, { amount: 10, txid: 'nope' });
    expect(m.matched).toBe(false);
  });
  it('matches unique amount without txid', () => {
    const m = matchDeposit(deposits, { amount: 25.5 });
    expect(m.matched).toBe(true);
  });
  it('asks for txid on ambiguous amount', () => {
    const two = [
      { amount: '5.00', coin: 'USDT', txId: 'a1', status: 1 },
      { amount: '5.00', coin: 'USDT', txId: 'b2', status: 1 },
    ];
    const m = matchDeposit(two, { amount: 5 });
    expect(m.matched).toBe(false);
    expect(m.reason).toContain('TXID');
  });
  it('rejects missing amount', () => {
    const m = matchDeposit(deposits, { amount: 99 });
    expect(m.matched).toBe(false);
  });
  it('handles empty history', () => {
    expect(matchDeposit([], { amount: 10 }).matched).toBe(false);
  });
});
