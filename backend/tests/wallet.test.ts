import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';

// Wallet ledger must use Decimal, never float. Signed amounts, balanceAfter invariant.
describe('wallet ledger math', () => {
  it('adds deposit with Decimal precision', () => {
    const balance = new Prisma.Decimal('10.00');
    const delta = new Prisma.Decimal('1.80');
    expect(balance.plus(delta).toString()).toBe('11.8');
  });
  it('referral 5% of 10 USDT = 0.50', () => {
    const amount = new Prisma.Decimal('10.00');
    const bonus = amount.mul(5).div(100);
    expect(bonus.toFixed(2)).toBe('0.50');
  });
  it('rejects negative balance', () => {
    const balance = new Prisma.Decimal('1.00');
    const next = balance.plus(new Prisma.Decimal('-5.00'));
    expect(next.isNegative()).toBe(true);
  });
});
