import { useQuery } from '@tanstack/react-query';
import { get, post } from '../api';
import { Badge, Button, Card, Empty, Skeleton, toast } from '../ui';

type BinancePay = { id: string; merchantOrderNo: string; bizOrderId?: string; amount: number; currency: string; status: string; verifiedAt?: string; createdAt: string };
type Manual = { id: string; orderNo: string; amountUsdt: number; txid?: string; createdAt: string; user?: { telegramId: string; username?: string }; product?: { name: string } };

export default function Payments() {
  const bin = useQuery({ queryKey: ['bin'], queryFn: () => get('/api/payments/binance') as Promise<{ items: BinancePay[] }> });
  const man = useQuery({ queryKey: ['manual'], queryFn: () => get('/api/payments/manual') as Promise<{ items: Manual[] }> });

  async function decide(orderId: string, approve: boolean) {
    try {
      await post(`/api/payments/manual/${orderId}`, { approve, note: approve ? 'approved via panel' : 'rejected via panel' });
      toast(approve ? 'Approved + credited' : 'Rejected'); man.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  async function autoVerify(orderId: string) {
    toast('Checking Binance…');
    try {
      const r = (await post(`/api/payments/verify/${orderId}`, {})) as { matched: boolean; reason: string };
      toast(r.matched ? `✅ Verified: ${r.reason}` : `⚠️ ${r.reason}`);
      if (r.matched) man.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Manual deposits queue</h1>
        <Card>
          {man.isLoading ? <Skeleton className="h-32" /> : !man.data?.items.length ? <Empty text="No pending manual deposits 🎉" /> : (
            <table className="w-full text-sm"><tbody>
              {man.data.items.map((m) => (
                <tr key={m.id} className="border-t dark:border-slate-800">
                  <td className="p-2 font-mono text-xs">{m.orderNo}<div className="text-slate-500">{m.user?.username ? `@${m.user.username}` : m.user?.telegramId} · {m.product?.name}</div>
                    <div className="break-all">TXID: {m.txid ?? '—'}</div></td>
                  <td className="p-2 text-right font-bold">${Number(m.amountUsdt).toFixed(2)}</td>
                  <td className="p-2 text-right"><div className="flex justify-end gap-1">
                    <Button variant="outline" onClick={() => autoVerify(m.id)}>🤖 Auto-verify</Button>
                    <Button variant="green" onClick={() => decide(m.id, true)}>Approve</Button>
                    <Button variant="danger" onClick={() => decide(m.id, false)}>Reject</Button>
                  </div></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
      </div>
      <div>
        <h1 className="text-xl font-extrabold">Binance Pay transactions</h1>
        <Card>
          {bin.isLoading ? <Skeleton className="h-48" /> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="p-2">Merchant order</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Verified</th></tr></thead>
              <tbody>{(bin.data?.items ?? []).map((b) => (
                <tr key={b.id} className="border-t dark:border-slate-800">
                  <td className="p-2 font-mono text-xs">{b.merchantOrderNo}</td>
                  <td className="p-2 font-semibold">{Number(b.amount).toFixed(2)} {b.currency}</td>
                  <td className="p-2"><Badge tone={b.status === 'PAID' ? 'green' : 'amber'}>{b.status}</Badge></td>
                  <td className="p-2">{b.verifiedAt ? <Badge tone="green">✓ {new Date(b.verifiedAt).toLocaleString()}</Badge> : <Badge>unverified</Badge>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
    </div>
  );
}
