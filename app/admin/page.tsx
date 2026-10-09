'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Toast, PrimaryButton } from '@/components/ui';
export default function Admin() {
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState('inv');
  const prods = useQuery({ queryKey: ['admin-prods'], queryFn: async () => (await fetch('/api/admin/products')).json() });
  const orders = useQuery({ queryKey: ['admin-orders'], queryFn: async () => (await fetch('/api/admin/orders')).json(), enabled: tab === 'orders' });
  const [price, setPrice] = useState('');
  const [sel, setSel] = useState('');
  const [codes, setCodes] = useState('');
  const [restockQty, setRestockQty] = useState('10');
  async function patch(addStock?: number) {
    const r = await fetch('/api/admin/products', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: sel, priceUsdt: price ? Number(price) : undefined, addStock }) });
    setToast(r.ok ? 'Saved' : 'Failed'); prods.refetch();
  }
  async function importCodes() {
    const r = await fetch('/api/admin/codes/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: sel, codes }) });
    const j = await r.json(); setToast(r.ok ? `Imported ${j.imported}` : 'Failed'); prods.refetch();
  }
  async function broadcast() {
    const r = await fetch('/api/admin/restocks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: sel, qty: Number(restockQty) }) });
    setToast(r.ok ? 'Broadcast sent' : 'Failed');
  }
  async function refund(orderId: string) {
    const r = await fetch('/api/admin/refund', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }) });
    setToast(r.ok ? 'Refund initiated (vault rows released)' : 'Failed'); orders.refetch();
  }
  async function fulfill(orderId: string) {
    const r = await fetch('/api/admin/orders/fulfill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }) });
    const j = await r.json().catch(() => ({}));
    setToast(r.ok ? `Fulfilled: ${j.status}` : (j.error ?? 'Failed')); orders.refetch();
  }
  return (
    <main className="pt-4 space-y-3">
      <h1 className="text-lg font-bold">🛠 Admin</h1>
      <div className="flex gap-2">
        {[['inv', 'Inventory'], ['orders', 'Orders'], ['stats', 'Stats']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-black text-white' : 'bg-white'}`}>{label}</button>
        ))}
      </div>
      {tab === 'inv' && (
        <Card>
          <label className="text-sm font-semibold">Product</label>
          <select aria-label="product" value={sel} onChange={(e) => setSel(e.target.value)} className="mt-1 w-full rounded-[12px] border px-3 py-3">
            <option value="">Select…</option>
            {(prods.data?.products ?? []).map((p: any) => (<option key={p.id} value={p.id}>{p.title} (${p.priceUsdt} • {p.stock})</option>))}
          </select>
          <div className="mt-2 flex gap-2">
            <input aria-label="price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="New price USDT" className="w-full rounded-[12px] border px-3 py-3 text-sm" />
            <button onClick={() => patch()} className="rounded-[12px] bg-black px-4 py-3 text-sm font-semibold text-white">Set</button>
          </div>
          <label className="mt-3 block text-sm font-semibold">Bulk code import (one per line)</label>
          <textarea aria-label="codes" value={codes} onChange={(e) => setCodes(e.target.value)} rows={4} className="mt-1 w-full rounded-[12px] border px-3 py-2 font-mono text-xs" placeholder={'CODE-1\nCODE-2'} />
          <div className="mt-2"><PrimaryButton onClick={importCodes}>Import codes</PrimaryButton></div>
          <div className="mt-3 flex items-center gap-2">
            <input aria-label="qty" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} className="w-24 rounded-[12px] border px-3 py-3 text-sm" />
            <button onClick={broadcast} className="flex-1 rounded-[12px] bg-[#57C25E] px-4 py-3 font-semibold text-white">🎁 Restock broadcast</button>
          </div>
        </Card>
      )}
      {tab === 'orders' && (
        <div className="space-y-2">
          {(orders.data?.orders ?? []).map((o: any) => (
            <Card key={o.id}>
              <div className="text-sm font-semibold">{o.productId} × {o.qty} — ${o.total} [{o.status}]</div>
              <div className="mt-1 text-xs text-gray-500">{o.id}</div>
              {(o.deliveries ?? []).length > 0 && (
                <div className="mt-1 space-y-1">
                  {(o.deliveries ?? []).map((d: any, i: number) => (
                    <div key={i} className="rounded bg-gray-50 px-2 py-1 font-mono text-xs">{d.login} / {d.password}</div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                {(o.status === 'NEEDS_REVIEW' || o.status === 'PENDING') && (
                  <button onClick={() => fulfill(o.id)} className="rounded-[10px] bg-[#57C25E] px-3 py-2 text-sm font-semibold text-white">Fulfill now</button>
                )}
                <button onClick={() => refund(o.id)} className="rounded-[10px] bg-[#D6365B] px-3 py-2 text-sm font-semibold text-white">Refund Stars</button>
              </div>
            </Card>
          ))}
          <Card><p className="text-xs">Webhook log (intents): {(orders.data?.intents ?? []).length} recent. Revenue: ${orders.data?.revenue ?? 0}</p></Card>
        </div>
      )}
      {tab === 'stats' && <Card><p className="text-sm">Revenue: <b>${orders.data?.revenue ?? '— (open Orders tab)'}</b></p><p className="mt-1 text-xs text-gray-500">Low-stock alert threshold: 5 (see product stock badges).</p></Card>}
      {toast && <div className="tg-toast rounded-full bg-black/85 px-4 py-2 text-sm text-white">{toast}</div>}
    </main>
  );
}
