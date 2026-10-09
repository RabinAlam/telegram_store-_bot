import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tzGetTzOrders, tzFulfillOrder, tzRefundOrder, tzGetProducts, type TzOrder } from '../tzstore';
import { Badge, Button, Card, Drawer, Empty, Input, Select, Skeleton, toast } from '../ui';

// Admin Orders — LIVE TZ Store order book (Next.js :3000 /api/admin/orders).
// Same orders the storefront/bot create: payment intents + delivery status.
const tone = (s: string) =>
  s === 'DELIVERED' || s === 'CONFIRMED' || s === 'FULFILLED' || s === 'PAID' ? 'green'
  : s === 'PENDING' ? 'amber'
  : s === 'NEEDS_REVIEW' || s === 'REFUNDING' ? 'blue' : 'red';

export default function Orders() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const book = useQuery({ queryKey: ['tz-orders'], queryFn: tzGetTzOrders, refetchInterval: 10000 });
  const prods = useQuery({ queryKey: ['tz-products'], queryFn: tzGetProducts });
  const pname = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of prods.data?.products ?? []) m[p.id] = p.title;
    return m;
  }, [prods.data]);

  const intents = useMemo(() => {
    const m: Record<string, { provider: string; asset: string; status: string; txHash?: string; address?: string; expiresAt: string }> = {};
    for (const i of book.data?.intents ?? []) m[i.orderId] = i;
    return m;
  }, [book.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (book.data?.orders ?? []).filter((o) => {
      const it = intents[o.id];
      if (status && o.status !== status) return false;
      if (method && (it?.provider ?? '—') !== method) return false;
      if (!q) return true;
      return o.id.toLowerCase().includes(q) || o.userTg.toLowerCase().includes(q) ||
        o.productId.toLowerCase().includes(q) || (it?.txHash ?? '').toLowerCase().includes(q);
    });
  }, [book.data, intents, search, status, method]);

  const sel: TzOrder | undefined = book.data?.orders.find((o) => o.id === detail);
  const selIntent = detail ? intents[detail] : undefined;

  async function fulfill() {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await tzFulfillOrder(detail);
      toast(r.status === 'DELIVERED' ? '✅ Delivered' : `Status: ${r.status}`);
      book.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'fulfill failed'); }
    finally { setBusy(false); }
  }

  async function refund() {
    if (!detail || !confirm('Refund this order? Vault items return to stock.')) return;
    setBusy(true);
    try {
      await tzRefundOrder(detail);
      toast('Refund started'); book.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'refund failed'); }
    finally { setBusy(false); }
  }

  const statuses = ['PENDING', 'DELIVERED', 'NEEDS_REVIEW', 'CANCELLED', 'REFUNDING'];
  const methods = ['STARS', 'BINANCE', 'TRC20', 'BEP20', 'BTC'];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-extrabold">Order book</h1>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">TZ Store live</span>
        <span className="text-sm text-slate-500">Revenue: <b>${Number(book.data?.revenue ?? 0).toFixed(2)}</b></span>
        <div className="flex-1" />
        <Input placeholder="Search orderNo / txid / user…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-60" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status: all</option>{statuses.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">Method: all</option>{methods.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </div>
      <Card>
        {book.isLoading ? <Skeleton className="h-64" /> : book.error ? (
          <Empty text={`TZ Store unreachable: ${(book.error as Error).message} — is :3000 running?`} />
        ) : rows.length === 0 ? <Empty text="No orders match" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500">
              <th className="p-2">Order</th><th className="p-2">User</th><th className="p-2">Qty · Total</th>
              <th className="p-2">Payment</th><th className="p-2">Status</th><th className="p-2">Date</th><th className="p-2" />
            </tr></thead>
            <tbody>{rows.map((o) => {
              const it = intents[o.id];
              return (
                <tr key={o.id} className="border-t dark:border-slate-800">
                  <td className="p-2 font-mono text-xs">{o.id}<div className="text-slate-500">{pname[o.productId] ?? o.productId}</div></td>
                  <td className="p-2 font-mono text-xs">{o.userTg}</td>
                  <td className="p-2">×{o.qty} · <b>${Number(o.total).toFixed(2)}</b></td>
                  <td className="p-2">
                    <div className="text-xs font-semibold">{it?.provider ?? '—'}</div>
                    {it?.txHash && <div className="max-w-32 truncate font-mono text-[11px] text-slate-500" title={it.txHash}>{it.txHash}</div>}
                    {it && <Badge tone={tone(it.status)}>{it.status}</Badge>}
                  </td>
                  <td className="p-2"><Badge tone={tone(o.status)}>{o.status}</Badge></td>
                  <td className="p-2 text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="p-2 text-right"><Button variant="outline" onClick={() => setDetail(o.id)}>Open</Button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
      <Drawer open={!!detail} onClose={() => setDetail(null)} title={`Order ${detail}`}>
        {!sel ? <Empty text="Not found" /> : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><div className="text-xs text-slate-500">Product</div><div className="font-semibold">{pname[sel.productId] ?? sel.productId} ×{sel.qty}</div></div>
              <div><div className="text-xs text-slate-500">Total</div><div className="font-semibold">${Number(sel.total).toFixed(2)} (${Number(sel.unitPrice).toFixed(2)} each)</div></div>
              <div><div className="text-xs text-slate-500">User</div><div className="font-mono text-xs">{sel.userTg}</div></div>
              <div><div className="text-xs text-slate-500">Status</div><Badge tone={tone(sel.status)}>{sel.status}</Badge></div>
              <div><div className="text-xs text-slate-500">Payment</div><div className="font-semibold">{selIntent ? `${selIntent.provider} · ${selIntent.asset}` : '—'}</div></div>
              <div><div className="text-xs text-slate-500">TxID / Order ID</div><div className="break-all font-mono text-xs">{selIntent?.txHash ?? '—'}</div></div>
              {selIntent?.address && <div className="col-span-2"><div className="text-xs text-slate-500">Payer UID / address</div><div className="break-all font-mono text-xs">{selIntent.address}</div></div>}
              <div><div className="text-xs text-slate-500">Created</div><div className="text-xs">{new Date(sel.createdAt).toLocaleString()}</div></div>
              {sel.code && <div><div className="text-xs text-slate-500">Delivery code</div><div className="break-all font-mono text-xs">{sel.code}</div></div>}
            </div>
            {sel.deliveries && sel.deliveries.length > 0 && (
              <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                <p className="mb-1 text-xs font-bold">Delivered accounts</p>
                {sel.deliveries.map((d, i) => <p key={i} className="break-all font-mono text-xs">{d.login} | {d.password}</p>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="green" onClick={fulfill} disabled={busy}>Fulfill / Retry delivery</Button>
              <Button variant="danger" onClick={refund} disabled={busy}>Refund</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
