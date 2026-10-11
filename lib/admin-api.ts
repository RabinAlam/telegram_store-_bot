// Shared-catalog link: user storefront reads categories/products from
// PostgreSQL (Supabase) via Prisma directly so admin edits appear instantly
// without HTTP roundtrips. Falls back to local demo store if DB is down.
import { db } from './db';

const BASE = process.env.ADMIN_API_URL ?? process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '';

async function backendGet<T>(path: string): Promise<T | null> {
  if (!BASE) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch(`${BASE}${path}`, { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const slugOf = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const LOGO_OVERRIDES: Record<string, string> = {
  'tz-vip': '/logos/tz-vip.svg',
  'muse-ai': '/logos/muse.svg',
  'telegram-premium': '/logos/telegram-premium.svg',
  youtube: '/logos/youtube.svg',
};

export async function sharedCategories() {
  const prisma = db();
  if (prisma) {
    try {
      const cats = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (cats.length > 0) {
        return cats.map((c, i) => ({
          slug: slugOf(c.name),
          backendId: c.id,
          name: c.name,
          emoji: c.emoji,
          sort: c.sortOrder ?? i,
          logo: LOGO_OVERRIDES[slugOf(c.name)] ?? `/logos/${slugOf(c.name)}.svg`,
        }));
      }
    } catch (e) {
      console.warn('Prisma sharedCategories error, falling back:', e);
    }
  }

  // Fallback to HTTP if external backend URL is configured
  if (BASE) {
    const j = await backendGet<{ categories: Array<{ id: string; name: string; emoji: string; sortOrder: number }> }>('/api/public/categories');
    if (j) {
      return j.categories.map((c, i) => ({
        slug: slugOf(c.name),
        backendId: c.id,
        name: c.name,
        emoji: c.emoji,
        sort: c.sortOrder ?? i,
        logo: LOGO_OVERRIDES[slugOf(c.name)] ?? `/logos/${slugOf(c.name)}.svg`,
      }));
    }
  }

  return null;
}

export async function sharedProductsBySlug(slug: string) {
  const prisma = db();
  if (prisma) {
    try {
      const cats = await prisma.category.findMany({ where: { isActive: true } });
      const cat = cats.find((c) => slugOf(c.name) === slug);
      if (cat) {
        const products = await prisma.product.findMany({
          where: { categoryId: cat.id, isActive: true },
          include: {
            stock: { where: { isSold: false } },
            category: true,
          },
          orderBy: { sortOrder: 'asc' },
        });
        return products.map((p) => {
          const stock = p.stock.length;
          return {
            id: p.id,
            categorySlug: slug,
            title: p.name,
            desc: p.description,
            contents: p.description,
            priceUsdt: Number(p.priceUsdt),
            tiers: [] as Array<{ minQty: number; unitPrice: number }>,
            stock,
            status: (stock > 0 ? 'ACTIVE' : 'OOS') as 'ACTIVE' | 'OOS',
            logo: LOGO_OVERRIDES[slug] ?? `/logos/${slug}.svg`,
          };
        });
      }
    } catch (e) {
      console.warn('Prisma sharedProductsBySlug error:', e);
    }
  }

  return null;
}

export async function sharedProduct(id: string) {
  const prisma = db();
  if (prisma) {
    try {
      const p = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          stock: { where: { isSold: false } },
        },
      });
      if (p) {
        const slug = slugOf(p.category.name);
        const stock = p.stock.length;
        return {
          id: p.id,
          categorySlug: slug,
          title: p.name,
          desc: p.description,
          contents: p.description,
          priceUsdt: Number(p.priceUsdt),
          tiers: [] as Array<{ minQty: number; unitPrice: number }>,
          stock,
          status: (stock > 0 ? 'ACTIVE' : 'OOS') as 'ACTIVE' | 'OOS',
          logo: LOGO_OVERRIDES[slug] ?? `/logos/${slug}.svg`,
        };
      }
    } catch (e) {
      console.warn('Prisma sharedProduct error:', e);
    }
  }
  return null;
}

export async function syncOrderToBackend(order: { orderNo: string; userTg: string; productId: string; qty: number; amountUsdt: number }) {
  const prisma = db();
  if (prisma) {
    try {
      let tgId: bigint;
      try {
        tgId = BigInt(order.userTg);
      } catch {
        tgId = BigInt(999999999);
      }
      await prisma.user.upsert({
        where: { telegramId: tgId },
        create: {
          telegramId: tgId,
          referralCode: `ref_${tgId.toString().slice(-6)}`,
          status: 'ACTIVE',
        },
        update: {},
      });
      const prod = await prisma.product.findUnique({ where: { id: order.productId } });
      if (prod) {
        await prisma.order.upsert({
          where: { orderNo: order.orderNo },
          create: {
            orderNo: order.orderNo,
            userId: tgId,
            productId: order.productId,
            qty: order.qty,
            amountUsdt: order.amountUsdt,
            paymentMethod: 'BINANCE_PAY',
            paymentStatus: 'PENDING',
            deliveryStatus: 'PENDING',
          },
          update: {},
        });
        return true;
      }
    } catch (e) {
      console.warn('Prisma syncOrderToBackend error:', e);
    }
  }
  return false;
}
