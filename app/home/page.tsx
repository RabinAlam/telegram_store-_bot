'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Skeleton, Toast, CatLogo } from '@/components/ui';
import { haptic, mainButton } from '@/lib/tma';
import { useEffect } from 'react';
export default function Home() {
  const [q, setQ] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'products'>('landing');
  const cats = useQuery({ queryKey: ['cats'], queryFn: async () => (await fetch('/api/categories')).json() });
  const feed = useQuery({ queryKey: ['feed'], queryFn: async () => (await fetch('/api/feed/restocks')).json() });
  useEffect(() => mainButton('My Orders', () => (window.location.href = '/orders')), []);
  useEffect(() => {
    try {
      const tg = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      if (tg) setUser({ name: `${tg.first_name ?? ''} ${tg.last_name ?? ''}`.trim() || 'TZ User', id: tg.id });
    } catch {}
  }, []);
  const list = (cats.data?.categories ?? []).filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase()));
  const name = user?.name ?? 'Guest';
  const id = user?.id ?? '—';
  return (
    <main className="pt-4 space-y-3">
      {view === 'landing' ? (
      <Card className="p-4">
        <p className="text-[15px]">🟢 <b>Name:</b> {name}</p>
        <p className="text-[15px]">🪪 <b>ID:</b> <code>{id}</code></p>
        <p className="text-[15px]">💳 <b>Wallet Balance:</b> $0.00</p>
        <p className="text-[15px]">🎁 <b>Referral Earnings:</b> $0.00</p>
        <p className="mt-2 text-sm text-gray-600">Choose an option below 👇</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { setView('products'); haptic('light'); }} className="rounded-[12px] bg-[#57C25E] px-3 py-3 text-center text-[15px] font-bold text-white">🛍 Category Product</button>
          <Link href="/deposit" className="rounded-[12px] bg-[#4A90D9] px-3 py-3 text-center text-[15px] font-bold text-white">💲 Deposit</Link>
          <Link href="/referrals" className="rounded-[12px] bg-[#57C25E] px-3 py-3 text-center text-[15px] font-bold text-white">🎁 Referrals</Link>
          <Link href="/orders" className="rounded-[12px] bg-[#4A90D9] px-3 py-3 text-center text-[15px] font-bold text-white">🎁 My Orders</Link>
          <a href="https://t.me/TZStoreSupport" className="rounded-[12px] bg-[#4A90D9] px-3 py-3 text-center text-[15px] font-bold text-white">🎧 Support</a>
          <Link href="/about" className="rounded-[12px] bg-[#4A90D9] px-3 py-3 text-center text-[15px] font-bold text-white">🔎 About</Link>
          <a href="https://t.me/TZStoreChannel" className="col-span-2 rounded-[12px] bg-[#57C25E] px-3 py-3 text-center text-[15px] font-bold text-white">📣 Join Our Channel ↗</a>
        </div>
      </Card>
      ) : (
      <>
      <input aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GitHub, Gemini, VPN…" className="w-full rounded-[14px] bg-white px-4 py-3 text-[15px] shadow-sm outline-none" />
      {(feed.data?.restocks ?? []).slice(0, 3).map((r: any) => (
        <Card key={r.id} className="border-l-4 border-l-[#57C25E]">
          <p className="text-sm font-medium">🎁 {r.message}</p>
          <Link className="tight text-sm font-semibold text-[#4A90D9]" href="/feed">Buy Now →</Link>
        </Card>
      ))}
      <h1 id="products" className="text-lg font-bold">🛒 TZ Store — Products</h1>
      {cats.isLoading ? (<div className="grid grid-cols-2 gap-2"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map((c: any) => (
            <Link key={c.slug} href={`/c/${c.slug}`} onClick={() => haptic('light')} className="tg-card tg-press p-4 text-center">
              <div className="flex justify-center"><CatLogo logo={c.logo} emoji={c.emoji} name={c.name} size={44} /></div>
              <div className="mt-1 text-[15px] font-semibold">{c.name}</div>
            </Link>
          ))}
        </div>
      )}
      <button onClick={() => setView('landing')} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
      </>
      )}
      <Toast msg={toast} />
    </main>
  );
}
