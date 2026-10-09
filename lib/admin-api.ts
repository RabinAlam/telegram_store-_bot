// Shared-catalog link: user storefront reads categories/products from the
// backend API (same DB the admin panel + bot use), so admin edits appear
// instantly. Falls back to the local demo store when backend/DB is down.
const BASE = process.env.ADMIN_API_URL ?? process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:4000';

async function backendGet<T>(path: string): Promise<T | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
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

type BackendCat = { id: string; name: string; emoji: string; sortOrder: number };
type BackendProduct = {
  id: string; categoryId: string; name: string; description: string;
  priceUsdt: number; deliveryMode: string; category?: { name: string };
  stockCount?: number;
};

const LOGO_OVERRIDES: Record<string, string> = {
  'tz-vip': '/logos/tz-vip.svg',
  'muse-ai': '/logos/muse.svg',
  'telegram-premium': '/logos/telegram-premium.svg',
  youtube: '/logos/youtube.svg',
};

export async function sharedCategories() {
  const j = await backendGet<{ categories: BackendCat[] }>('/api/public/categories');
  if (!j) return null;
  return j.categories.map((c, i) => ({
    slug: slugOf(c.name),
    backendId: c.id,
    name: c.name,
    emoji: c.emoji,
    sort: c.sortOrder ?? i,
    logo: LOGO_OVERRIDES[slugOf(c.name)] ?? `/logos/${slugOf(c.name)}.svg`,
  }));
}

export async function sharedProductsBySlug(slug: string) {
  const cats = await sharedCategories();
  const cat = cats?.find((c) => c.slug === slug);
  if (!cat) return null;
  const j = await backendGet<{ products: BackendProduct[] }>(
    `/api/public/products?categoryId=${encodeURIComponent(cat.backendId)}`,
  );
  if (!j) return null;
  return j.products.map((p) => toLocalProduct(p, slug));
}

export async function sharedProduct(id: string) {
  const j = await backendGet<{ product: BackendProduct }>(`/api/public/products/${encodeURIComponent(id)}`);
  if (!j) return null;
  const slug = slugOf(j.product.category?.name ?? '');
  return toLocalProduct(j.product, slug);
}

function toLocalProduct(p: BackendProduct, slug: string) {
  const stock = p.stockCount ?? 0;
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
