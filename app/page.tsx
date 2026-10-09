'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initTma, initDataRaw, haptic } from '@/lib/tma';
import { Card, Skeleton } from '@/components/ui';
export default function Splash() {
  const router = useRouter();
  const [msg, setMsg] = useState('Connecting…');
  const [outside, setOutside] = useState(false);
  useEffect(() => {
    const w = initTma();
    if (!w) setOutside(true);
    (async () => {
      try {
        const initData = initDataRaw();
        if (initData) {
          const r = await fetch('/api/auth/telegram', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }) });
          const j = await r.json();
          if (j.token) { localStorage.setItem('tz_jwt', j.token); haptic('success'); }
        } else {
          setMsg('Browser preview — catalog still browsable.');
        }
      } catch { setMsg('Offline preview — catalog still browsable.'); }
      const sp = new URLSearchParams(window.location.search).get('startapp');
      if (sp?.startsWith('product_')) router.replace(`/p/${sp.slice(8)}`);
      else if (sp?.startsWith('restock_')) router.replace('/feed');
      else if (sp?.startsWith('order_')) router.replace(`/success/${sp.slice(6)}`);
      else router.replace('/home');
    })();
  }, [router]);
  return (
    <main className="pt-10">
      <Card><div className="text-center"><div className="text-2xl">🛒 TZ Store</div><p className="mt-1 text-sm text-gray-500">{msg}</p></div></Card>
      <div className="mt-3 space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      {outside && (
        <Card className="mt-3"><p className="text-sm">Opened outside Telegram. <a className="text-[#4A90D9] underline" href="https://t.me/TZStoreBot?startapp=home">Open in Telegram</a></p></Card>
      )}
    </main>
  );
}
