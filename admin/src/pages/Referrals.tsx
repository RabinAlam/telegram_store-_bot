import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, api } from '../api';
import { Button, Card, Empty, Input, Skeleton, toast } from '../ui';

export default function Referrals() {
  const [pct, setPct] = useState('');
  const settings = useQuery({ queryKey: ['ref-set'], queryFn: () => get('/api/referrals/settings') as Promise<{ percent: number }> });
  const board = useQuery({ queryKey: ['ref-board'], queryFn: () => get('/api/referrals/leaderboard') as Promise<Array<{ telegramId: string; username?: string; firstName?: string; referralEarnings: number; referralCode: string }>> });
  const ledger = useQuery({ queryKey: ['ref-ledger'], queryFn: () => get('/api/referrals/ledger') as Promise<{ items: Array<{ id: string; userId: string; amount: number; note: string; createdAt: string }> }> });

  async function save() {
    try {
      await api('/api/referrals/settings', { method: 'PUT', body: JSON.stringify({ percent: Number(pct) }) });
      toast('Commission updated'); settings.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  return (
    <div className="space-y-3">
      <Card><h2 className="font-bold">Global commission % (current: {settings.data?.percent ?? '…'}%)</h2>
        <div className="mt-2 flex gap-2"><Input type="number" min={0} max={50} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="e.g. 5" className="max-w-40" />
        <Button onClick={save}>Save</Button></div></Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card><h2 className="mb-2 font-bold">🏆 Leaderboard</h2>
          {board.isLoading ? <Skeleton className="h-48" /> : (
            <table className="w-full text-sm"><tbody>
              {(board.data ?? []).map((r, i) => <tr key={r.telegramId} className="border-t dark:border-slate-800">
                <td className="p-2">#{i + 1} {r.firstName} <code className="text-xs">{r.telegramId}</code></td>
                <td className="p-2 text-right font-bold">${Number(r.referralEarnings).toFixed(2)}</td></tr>)}
            </tbody></table>)}
        </Card>
        <Card><h2 className="mb-2 font-bold">Commission ledger</h2>
          {ledger.isLoading ? <Skeleton className="h-48" /> : !ledger.data?.items.length ? <Empty text="No commissions yet" /> : (
            <table className="w-full text-xs"><tbody>
              {ledger.data.items.map((t) => <tr key={t.id} className="border-t dark:border-slate-800">
                <td className="p-2"><code>{t.userId}</code> · {t.note}</td>
                <td className="p-2 text-right font-bold">+{Number(t.amount).toFixed(2)}</td></tr>)}
            </tbody></table>)}
        </Card>
      </div>
    </div>
  );
}
