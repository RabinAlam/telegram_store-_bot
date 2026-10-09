'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Zap, ShieldCheck, PackageCheck, BellRing, Check } from 'lucide-react';
import { Card, StockBadge, Skeleton, Toast, CatLogo } from '@/components/ui';
import { backButton, haptic, mainButton, tzAuthHeader } from '@/lib/tma';

type Tier = { minQty: number; unitPrice: number };

function tierRange(tiers: Tier[], i: number) {
  const cur = tiers[i];
  const next = tiers[i + 1];
  if (!next) return `${cur.minQty}+ pcs`;
  if (next.minQty === cur.minQty + 1) return `${cur.minQty} pc`;
  return `${cur.minQty}–${next.minQty - 1} pcs`;
}

export default function ProductDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [qtyText, setQtyText] = useState('1');
  const [toast, setToast] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => backButton(() => router.back()), [router]);
  const { data, isLoading } = useQuery({
    queryKey: ['p', params.id],
    queryFn: async () => (await fetch(`/api/products/${params.id}`)).json(),
  });
  const p = data?.product;
  const tiers: Tier[] = useMemo(
    () => [...(p?.tiers ?? [])].sort((a: Tier, b: Tier) => a.minQty - b.minQty),
    [p]
  );
  const oos = !!p && p.stock <= 0;
  const maxQty = p ? Math.min(p.stock, 100) : 1;

  useEffect(() => {
    if (!p || oos) return;
    let live = true;
    fetch('/api/orders/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: p.id, qty }),
    })
      .then((r) => r.json())
      .then((j) => live && setQuote(j))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [p, oos, qty]);

  const total = quote?.total ?? (p ? Math.round(p.priceUsdt * qty * 100) / 100 : 0);
  const unit = quote?.unitPrice ?? p?.priceUsdt ?? 0;
  const savings = quote?.savings ?? 0;

  useEffect(() => {
    if (!p || oos) return;
    return mainButton(`Buy ${qty} • $${total.toFixed(2)}`, () => go());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, oos, qty, total]);

  async function go() {
    if (buying || !p || oos) return;
    setBuying(true);
    haptic('light');
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...tzAuthHeader() },
        body: JSON.stringify({ productId: p.id, qty }),
      });
      const j = await r.json();
      if (!r.ok) {
        setToast(j.error ?? 'Order failed');
        haptic('error');
        return;
      }
      router.push(`/checkout/${j.order.id}`);
    } finally {
      setBuying(false);
    }
  }

  async function notify() {
    await fetch('/api/notify-me', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...tzAuthHeader() },
      body: JSON.stringify({ productId: p.id }),
    });
    setToast('✅ We will notify you on restock');
    haptic('success');
  }

  if (isLoading)
    return (
      <main className="space-y-3 pt-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-44" />
        <Skeleton className="h-36" />
        <Skeleton className="h-48" />
      </main>
    );
  if (!p)
    return (
      <main className="pt-4">
        <Card>Product not found.</Card>
      </main>
    );

  const activeTier = tiers.reduce(
    (acc: number, t: Tier, i: number) => (qty >= t.minQty ? i : acc),
    -1
  );

  return (
    <main className="space-y-3 pt-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-gray-500">
        <Link href="/home" className="tight hover:underline">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/c/${p.categorySlug}`} className="tight capitalize hover:underline">
          {p.categorySlug.replace('-', ' ')}
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-gray-700">{p.title}</span>
      </nav>

      {/* Hero */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-gray-50 p-2.5 shadow-inner">
            <CatLogo logo={(p as any).logo} emoji="📦" name={p.title} size={56} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {(p.categorySlug ?? '').replace('-', ' ')}
            </p>
            <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight text-gray-900">
              {p.title}
              {oos && <span className="text-gray-400"> (out of stock)</span>}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StockBadge stock={p.stock} />
              {p.stock > 0 && p.stock <= 5 && (
                <span className="tight rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                  🔥 Only {p.stock} left
                </span>
              )}
              {tiers.length > 0 && (
                <span className="tight rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  Bulk discounts
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs font-medium text-gray-500">Price per pc</p>
            <p className="text-[28px] font-extrabold leading-none text-gray-900">
              ${unit.toFixed(2)}
            </p>
          </div>
          {savings > 0 ? (
            <span className="tight rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              Save ${savings.toFixed(2)}
            </span>
          ) : (
            <span className="tight text-xs text-gray-400">Best price applied at checkout</span>
          )}
        </div>
      </Card>

      {/* About + delivery */}
      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-gray-900">About this product</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{p.desc}</p>
        <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-4 text-sm">
          <div className="flex items-start gap-2.5">
            <Zap size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-gray-600">
              <b className="font-semibold text-gray-900">Instant delivery</b> — code/link is
              auto-sent right after payment.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <PackageCheck size={16} className="mt-0.5 shrink-0 text-[#4A90D9]" />
            <p className="text-gray-600">{p.contents}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="text-gray-600">
              Covered by TZ Store support if your code doesn&apos;t work.
            </p>
          </div>
        </div>
      </Card>

      {/* Bulk pricing */}
      {tiers.length > 0 && !oos && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-gray-900">Bulk pricing</h2>
            <span className="tight text-xs text-gray-400">per pc</span>
          </div>
          <ul className="mt-2 divide-y divide-gray-100">
            {tiers.map((t: Tier, i: number) => {
              const active = i === activeTier;
              return (
                <li
                  key={t.minQty}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                    active ? 'bg-blue-50 font-semibold text-gray-900' : 'text-gray-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {tierRange(tiers, i)}
                    {active && (
                      <span className="tight inline-flex items-center gap-1 rounded-full bg-[#4A90D9] px-2 py-0.5 text-[11px] font-bold text-white">
                        <Check size={11} /> Applied
                      </span>
                    )}
                  </span>
                  <span className="font-bold">${t.unitPrice.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Quantity + CTA — professional */}
      {!oos ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Select quantity</h2>
              <p className="mt-0.5 text-xs text-gray-500">1–100 pcs • {maxQty} available</p>
            </div>
            <div className="flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm">
              <button
                aria-label="Decrease quantity"
                onClick={() => {
                  const n = Math.max(1, qty - 1);
                  setQty(n); setQtyText(String(n));
                  haptic('light');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 tg-press disabled:opacity-30"
                disabled={qty <= 1}
              >
                <Minus size={16} />
              </button>
              <input
                aria-label="Enter quantity 1 to 100"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={qtyText}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                  setQtyText(raw);
                  if (raw === '') return;
                  const n = Math.floor(Number(raw));
                  if (Number.isNaN(n)) return;
                  setQty(Math.max(1, Math.min(Math.min(100, maxQty), n)));
                }}
                onBlur={(e) => {
                  const n = Math.max(1, Math.min(Math.min(100, maxQty), Math.floor(Number(e.target.value) || 1)));
                  setQty(n); setQtyText(String(n));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-14 bg-transparent text-center text-lg font-extrabold tabular-nums text-gray-900 outline-none"
              />
              <button
                aria-label="Increase quantity"
                onClick={() => {
                  const n = Math.min(Math.min(100, maxQty), qty + 1);
                  setQty(n); setQtyText(String(n));
                  haptic('light');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 tg-press disabled:opacity-30"
                disabled={qty >= Math.min(100, maxQty)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <dt>Unit × {qty}</dt>
                <dd className="font-semibold tabular-nums">${unit.toFixed(2)} each</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between font-medium text-emerald-600">
                  <dt>Bulk savings</dt>
                  <dd className="tabular-nums">−${savings.toFixed(2)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-gray-200 pt-2.5">
                <dt className="text-base font-extrabold text-gray-900">Total</dt>
                <dd className="text-xl font-extrabold tabular-nums text-gray-900">${total.toFixed(2)}</dd>
              </div>
            </dl>
          </div>

          <button
            onClick={go}
            disabled={buying}
            className="mt-4 w-full rounded-2xl bg-[#57C25E] px-4 py-4 text-[15px] font-bold text-white shadow-md transition hover:brightness-95 tg-press disabled:opacity-50"
          >
            {buying ? 'Creating secure order…' : `Buy Now • ${qty} pc • $${total.toFixed(2)}`}
          </button>
          <p className="mt-2 text-center text-[11px] text-gray-400">🔒 Secure checkout • Instant delivery after payment</p>
        </Card>
      ) : (
        <Card className="p-5 text-center">
          <BellRing size={28} className="mx-auto text-gray-300" />
          <h2 className="mt-2 text-[15px] font-bold text-gray-900">Out of stock</h2>
          <p className="mt-1 text-sm text-gray-500">
            This item is gone right now — we&apos;ll ping you the moment it&apos;s back.
          </p>
          <button
            onClick={notify}
            className="mt-4 w-full rounded-[14px] bg-[#4A90D9] px-4 py-3.5 text-[15px] font-bold text-white transition tg-press"
          >
            Notify me on restock
          </button>
        </Card>
      )}

      {/* Sticky buy bar */}
      {!oos && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] z-40">
          <div className="tg-card flex items-center justify-between gap-3 border border-gray-100 p-3 pl-4 shadow-lg">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                Total • {qty} pc
              </p>
              <p className="text-xl font-extrabold tabular-nums text-gray-900">
                ${total.toFixed(2)}
              </p>
            </div>
            <button
              onClick={go}
              disabled={buying}
              className="flex-1 rounded-[12px] bg-[#57C25E] px-4 py-3 text-[15px] font-bold text-white transition tg-press disabled:opacity-50"
            >
              {buying ? '…' : 'Buy Now'}
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast} />
      <button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
    </main>
  );
}
