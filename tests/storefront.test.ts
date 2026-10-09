import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { unitPriceFor, PRODUCTS } from '../lib/seed-data';
import { slugOf } from '../lib/admin-api';

// quote() reads the file-backed store: isolate tests on a temp file so live
// shop data is never touched and results are deterministic (seed stock 100).
const TMP = path.join(process.cwd(), '.data-store.test.json');
let quote: (id: string, qty: number) => { unitPrice: number; total: number; savings: number };
let quoteSchema: { safeParse: (v: unknown) => { success: boolean } };

beforeAll(async () => {
  process.env.TZ_DATA_STORE = '.data-store.test.json';
  try { fs.unlinkSync(TMP); } catch { /* fresh */ }
  ({ quote, quoteSchema } = await import('../lib/pricing'));
});

afterAll(() => {
  try { fs.unlinkSync(TMP); } catch { /* ignore */ }
  delete process.env.TZ_DATA_STORE;
});

// Storefront buying logic: tiers, totals, stock guards, category slugs.
describe('unitPriceFor (bulk tiers)', () => {
  it('uses base price below first tier', () => {
    const p = PRODUCTS.find((x) => x.id === 'p-capcut-1m')!;
    expect(unitPriceFor(p, 1)).toBe(1.8);
    expect(unitPriceFor(p, 4)).toBe(1.8);
  });
  it('drops to tier price at minQty', () => {
    const p = PRODUCTS.find((x) => x.id === 'p-capcut-1m')!;
    expect(unitPriceFor(p, 5)).toBe(1.65);
    expect(unitPriceFor(p, 100)).toBe(1.65);
  });
  it('picks the best of stacked tiers', () => {
    const p = PRODUCTS.find((x) => x.id === 'p-gemini-18m')!;
    expect(unitPriceFor(p, 1)).toBe(0.75);
    expect(unitPriceFor(p, 6)).toBe(0.7);
    expect(unitPriceFor(p, 16)).toBe(0.65);
  });
});

describe('quote()', () => {
  it('computes total + savings for bulk qty', () => {
    const q = quote('p-capcut-1m', 5);
    expect(q.unitPrice).toBe(1.65);
    expect(q.total).toBe(8.25);
    expect(q.savings).toBeCloseTo(0.75, 2);
  });
  it('has zero savings at base price', () => {
    const q = quote('p-github-student', 2);
    expect(q.total).toBe(20);
    expect(q.savings).toBe(0);
  });
  it('rejects unknown product', () => {
    expect(() => quote('p-nope', 1)).toThrow('unknown product');
  });
  it('rejects qty above seed stock', () => {
    expect(() => quote('p-github-student', 101)).toThrow('not enough stock');
  });
});

describe('quoteSchema (1–100 ints)', () => {
  it('accepts 1 and 100', () => {
    expect(quoteSchema.safeParse({ productId: 'x', qty: 1 }).success).toBe(true);
    expect(quoteSchema.safeParse({ productId: 'x', qty: 100 }).success).toBe(true);
  });
  it('rejects 0, 101 and fractions', () => {
    expect(quoteSchema.safeParse({ productId: 'x', qty: 0 }).success).toBe(false);
    expect(quoteSchema.safeParse({ productId: 'x', qty: 101 }).success).toBe(false);
    expect(quoteSchema.safeParse({ productId: 'x', qty: 2.5 }).success).toBe(false);
  });
});

describe('slugOf (category links)', () => {
  it('maps display names to URL slugs', () => {
    expect(slugOf('Telegram Premium')).toBe('telegram-premium');
    expect(slugOf('TZ VIP')).toBe('tz-vip');
    expect(slugOf('Muse AI')).toBe('muse-ai');
    expect(slugOf('GitHub')).toBe('github');
  });
});
