'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Skeleton, Toast, PrimaryButton } from '@/components/ui';
import { haptic, mainButton, tzAuthHeader } from '@/lib/tma';
export default function Success({ params }: { params: { orderId: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => mainButton('Back to Home', () => router.push('/home')), [router]);
  useEffect(() => {
    let stop = false;
    async function poll() {
      const r = await fetch(`/api/orders?id=${params.orderId}`, { headers: { ...tzAuthHeader() } });
      const j = await r.json();
      if (stop) return;
      setOrder(j.order);
      if (j.order?.status === 'DELIVERED') { haptic('success'); return; }
      if (j.order?.status === 'CANCELLED') return;
      setTimeout(poll, 3000);
    }
    poll(); return () => { stop = true; };
  }, [params.orderId]);
  if (!order) return <main className="pt-4"><Skeleton className="h-40" /><p className="mt-2 text-center text-sm text-gray-500">Generating deposit…</p><button onClick={() => router.back()} className="mt-3 w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button></main>;
  if (order.status === 'CANCELLED') return <main className="pt-4"><Card><p className="font-semibold text-[#D6365B]">❌ Deposit cancelled</p><div className="mt-2"><PrimaryButton onClick={() => router.push('/home')}>Return to Menu</PrimaryButton></div></Card><button onClick={() => router.back()} className="mt-3 w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button></main>;
  if (order.status === 'NEEDS_REVIEW') return <main className="pt-4 space-y-3"><Card className="border-l-4 border-l-amber-400"><div className="font-bold">Payment received</div><p className="mt-1 text-sm">Order <b>{order.id}</b> — preparing your accounts. Delivery within 24h, support will contact you.</p></Card><button onClick={() => router.push('/orders')} className="w-full rounded-[14px] bg-gray-100 px-4 py-3 text-[15px] font-bold">My Orders</button><button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button></main>;
  if (order.status !== 'DELIVERED') return <main className="pt-4"><Card><p className="text-sm">⚡ Processing payment… status <b>{order.status}</b></p><p className="mt-1 text-xs text-gray-500">Order {order.id} • auto-detecting…</p></Card><button onClick={() => router.back()} className="mt-3 w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button></main>;
  const deliveries: Array<{ login: string; password: string }> = order.deliveries ?? [];
  return (
    <main className="pt-4 space-y-3">
      <Card className="border-l-4 border-l-[#57C25E]">
        <div className="font-bold">✅ Delivered</div>
        <p className="mt-1 text-sm">Order <b>{order.id}</b></p>
        {deliveries.length > 0 ? (
          <div className="mt-2 space-y-2">
            {deliveries.map((d, i) => (
              <div key={i} className="rounded-[12px] bg-gray-50 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account {deliveries.length > 1 ? i + 1 : ''}</div>
                <div className="mt-1 break-all font-mono">ID: {d.login}</div>
                <div className="break-all font-mono">PW: {d.password}</div>
                <button
                  className="mt-2 w-full rounded-[10px] bg-[#4A90D9] px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => { navigator.clipboard?.writeText(`${d.login} / ${d.password}`); setToast(`Account ${i + 1} copied`); haptic('success'); }}>
                  Copy account
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-2 rounded-[12px] bg-gray-50 p-3 break-all font-mono text-sm">{order.code}</div>
            <div className="mt-2 flex gap-2">
              <button className="flex-1 rounded-[12px] bg-[#4A90D9] px-4 py-3 font-semibold text-white" onClick={() => { navigator.clipboard?.writeText(order.code ?? ''); setToast('Copied'); haptic('success'); }}>Copy code</button>
              <button className="flex-1 rounded-[12px] bg-gray-100 px-4 py-3 font-semibold" onClick={() => router.push('/orders')}>My Orders</button>
            </div>
          </>
        )}
        {deliveries.length > 0 && (
          <button className="mt-2 w-full rounded-[12px] bg-gray-100 px-4 py-3 font-semibold" onClick={() => router.push('/orders')}>My Orders</button>
        )}
      </Card>
      <button onClick={() => router.push('/home')} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
      <Toast msg={toast} />
    </main>
  );
}
