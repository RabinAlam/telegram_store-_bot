'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wallet, Loader2, ChevronRight, ShieldCheck } from 'lucide-react';
import { Card, Skeleton, Toast, CatLogo } from '@/components/ui';
import { backButton, haptic, tzAuthHeader } from '@/lib/tma';

type Method = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  badge?: string;
};

const METHODS: Method[] = [
  { id: 'STARS', label: 'Telegram Stars', hint: 'Recommended • instant', icon: '/logos/pay-stars.svg', badge: 'Auto' },
  { id: 'BINANCE', label: 'Binance Pay', hint: 'UID transfer • manual review', icon: '/logos/pay-binance.svg' },
  { id: 'TRC20', label: 'USDT · TRC20', hint: 'Low fee • ~1 min', icon: '/logos/pay-tether.svg', badge: 'Auto' },
  { id: 'BEP20', label: 'USDT · BEP20', hint: 'Low fee • ~1 min', icon: '/logos/pay-tether.svg', badge: 'Auto' },
  { id: 'BTC', label: 'Bitcoin', hint: 'On-chain • ~10 min', icon: '/logos/pay-bitcoin.svg', badge: 'Auto' },
];

const money = (n: number) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Checkout({ params }: { params: { orderId: string } }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [binanceOpen, setBinanceOpen] = useState(false);
  const [uid, setUid] = useState('');

  useEffect(() => backButton(() => router.back()), [router]);
  const { data, isLoading } = useQuery({
    queryKey: ['order', params.orderId],
    queryFn: async () => (await fetch(`/api/orders?id=${params.orderId}`, { headers: { ...tzAuthHeader() } })).json(),
  });
  const order = data?.order;
  const product = data?.product;

  async function pay(provider: string, binanceUid?: string) {
    if (paying) return;
    if (provider === 'BINANCE' && !binanceUid?.trim()) {
      setToast('Enter your Binance UID first');
      haptic('warning');
      return;
    }
    setPaying(provider);
    haptic('light');
    try {
      const r = await fetch('/api/payments/intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...tzAuthHeader() },
        body: JSON.stringify({ orderId: params.orderId, provider, binanceUid }),
      });
      const j = await r.json();
      if (!r.ok) {
        setToast(j.error ?? 'Payment failed');
        haptic('error');
        return;
      }
      if (provider === 'STARS' && j.invoiceLink) {
        const w = (window as any)?.Telegram?.WebApp;
        if (w?.openInvoice) w.openInvoice(j.invoiceLink, () => router.push(`/pay/${j.intent.id}`));
        else router.push(`/pay/${j.intent.id}`);
      } else {
        router.push(`/pay/${j.intent.id}`);
      }
    } finally {
      setPaying(null);
    }
  }

  if (data?.error) return <main className="space-y-3 pt-4"><Card><p className="font-bold">Order not found</p><p className="mt-1 text-sm text-gray-600">This order does not exist or expired.</p></Card></main>;
  if (isLoading || !order)
    return (
      <main className="space-y-3 pt-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </main>
    );

  return (
    <main className="space-y-3 pt-4">
      {/* Order summary */}
      <Card className="p-5">
        <h1 className="text-[15px] font-bold text-gray-900">Order summary</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="shrink-0 rounded-xl bg-gray-50 p-1.5">
            <CatLogo
              logo={product?.logo}
              emoji="📦"
              name={product?.title ?? order.productId}
              size={44}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-gray-900">
              {product?.title ?? order.productId}
            </p>
            <p className="text-[13px] text-gray-500">Quantity × {order.qty}</p>
          </div>
        </div>
        <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <dt>
              Unit × {order.qty}
            </dt>
            <dd className="font-semibold tabular-nums">{money(order.unitPrice)} each</dd>
          </div>
          <div className="flex justify-between text-base font-extrabold text-gray-900">
            <dt>Total due</dt>
            <dd className="tabular-nums">{money(order.total)}</dd>
          </div>
        </dl>
      </Card>

      {/* Payment methods */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-[#4A90D9]" />
          <h2 className="text-[15px] font-bold text-gray-900">Payment method</h2>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          ⚡ All deposit methods are auto-detected &amp; instant
        </p>

        <ul className="mt-3 space-y-2">
          {METHODS.map((m) => {
            const active = paying === m.id;
            const open = m.id === 'BINANCE' && binanceOpen;
            return (
              <li key={m.id}>
                <button
                  onClick={() =>
                    m.id === 'BINANCE' ? setBinanceOpen((v) => !v) : pay(m.id)
                  }
                  disabled={paying !== null}
                  className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition tg-press disabled:opacity-70 ${
                    open ? 'border-[#4A90D9] bg-blue-50/50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <img
                    src={m.icon}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-bold text-gray-900">
                      {m.label}
                      {m.badge && (
                        <span className="tight rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">
                          {m.badge}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{m.hint}</span>
                  </span>
                  {active ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-[#4A90D9]" />
                  ) : (
                    <ChevronRight size={18} className="shrink-0 text-gray-300" />
                  )}
                </button>

                {open && (
                  <div className="mt-2 rounded-[14px] border border-[#4A90D9]/30 bg-blue-50/40 p-3">
                    <p className="rounded-[10px] bg-white p-2.5 text-[13px] text-gray-700">
                      📩 Send <b>exactly {money(order.total)}</b> to store UID:{' '}
                      <code className="font-bold text-gray-900">{process.env.NEXT_PUBLIC_BINANCE_UID ?? '1134278389'}</code>{' '}
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(process.env.NEXT_PUBLIC_BINANCE_UID ?? '1134278389'); setToast('Store UID copied'); }}
                        className="tight ml-1 text-[#4A90D9] underline"
                      >
                        Copy
                      </button>
                    </p>
                    <label
                      htmlFor="binance-uid"
                      className="mt-2 block text-xs font-semibold text-gray-700"
                    >
                      Your Binance UID
                    </label>
                    <input
                      id="binance-uid"
                      value={uid}
                      onChange={(e) => setUid(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      placeholder="e.g. 123456789"
                      className="mt-1.5 w-full rounded-[12px] border border-gray-200 bg-white px-4 py-3 text-[15px] tabular-nums outline-none focus:border-[#4A90D9]"
                    />
                    <button
                      onClick={() => pay('BINANCE', uid)}
                      disabled={paying !== null || !uid.trim()}
                      className="mt-2 w-full rounded-[12px] bg-[#4A90D9] px-4 py-3 text-sm font-bold text-white transition tg-press disabled:opacity-50"
                    >
                      {paying === 'BINANCE' ? 'Creating…' : `Confirm • ${money(order.total)}`}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-400">
          <ShieldCheck size={13} className="mt-px shrink-0" />
          Amounts are locked server-side. Underpayments are flagged for manual review — never
          send a different amount.
        </p>
      </Card>

      <Toast msg={toast} />
      <button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
    </main>
  );
}
