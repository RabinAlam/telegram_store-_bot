import { z } from 'zod';
import { unitPriceFor } from './seed-data';
import { store } from './store';
export const quoteSchema = z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(100) });
export function quote(productId: string, qty: number) {
  // store.getProduct covers seed + admin-added custom products with live price/stock.
  const p = store.getProduct(productId);
  if (!p) throw new Error('unknown product');
  if (p.status === 'OOS' || p.stock <= 0) throw new Error('out of stock');
  if (qty > p.stock) throw new Error('not enough stock');
  const tiers = (p as unknown as { tiers?: Array<{ minQty: number; unitPrice: number }> }).tiers ?? [];
  const unit = tiers.length ? unitPriceFor(p as unknown as Parameters<typeof unitPriceFor>[0], qty) : Number(p.priceUsdt);
  const total = Math.round(unit * qty * 100) / 100;
  const base = Math.round(Number(p.priceUsdt) * qty * 100) / 100;
  return { productId, qty, unitPrice: unit, total, savings: Math.round((base - total) * 100) / 100 };
}
