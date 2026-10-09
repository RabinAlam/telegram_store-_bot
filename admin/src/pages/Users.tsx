import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../api';
import { Badge, Button, Card, Drawer, Empty, Input, Skeleton, Textarea, toast } from '../ui';

type User = { telegramId: string; username?: string; firstName?: string; walletBalance: number; referralEarnings: number; referralCode: string; status: string; createdAt: string };

export default function Users() {
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const list = useQuery({
    queryKey: ['users', search],
    queryFn: () => get(`/api/users?${new URLSearchParams(search ? { search } : {})}`) as Promise<{ items: User[] }>,
  });
  const one = useQuery({
    queryKey: ['user', sel], enabled: !!sel,
    queryFn: () => get(`/api/users/${sel}`) as Promise<User & { totalSpent: number; referrals: User[]; orders: Array<{ id: string; orderNo: string; amountUsdt: number; paymentStatus: string }>; walletTxns: Array<{ id: string; type: string; amount: number; balanceAfter: number; note: string; createdAt: string }> }>,
  });

  async function adjust() {
    if (!sel || !delta || !reason) { toast('Amount + reason required'); return; }
    try {
      await post(`/api/users/${sel}/adjust`, { delta: Number(delta), reason });
      toast('Balance adjusted'); setDelta(''); setReason(''); one.refetch(); list.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  async function ban(banned: boolean) {
    await post(`/api/users/${sel}/ban`, { banned });
    toast(banned ? 'Banned' : 'Unbanned'); one.refetch(); list.refetch();
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Search Telegram ID or @username…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-80" />
      <Card>
        {list.isLoading ? <Skeleton className="h-48" /> : !list.data?.items.length ? <Empty text="No users" /> : (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase text-slate-500">
            <th className="p-2">User</th><th className="p-2">Wallet</th><th className="p-2">Referral $</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
            <tbody>{list.data.items.map((u) => (
              <tr key={u.telegramId} className="border-t dark:border-slate-800">
                <td className="p-2 font-semibold">{u.firstName ?? '—'} <span className="font-mono text-xs text-slate-500">{u.telegramId} {u.username ? `@${u.username}` : ''}</span></td>
                <td className="p-2 font-semibold">${Number(u.walletBalance).toFixed(2)}</td>
                <td className="p-2">${Number(u.referralEarnings).toFixed(2)}</td>
                <td className="p-2"><Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge></td>
                <td className="p-2 text-right"><Button variant="outline" onClick={() => setSel(u.telegramId)}>Profile</Button></td>
              </tr>
            ))}</tbody></table>
        )}
      </Card>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={`User ${sel}`}>
        {one.isLoading ? <Skeleton className="h-64" /> : one.data ? (
          <div className="space-y-3 text-sm">
            <Card><div className="text-xs text-slate-500">Wallet</div>
              <div className="text-2xl font-extrabold">${Number(one.data.walletBalance).toFixed(2)}</div>
              <div className="text-xs text-slate-500">Spent ${Number(one.data.totalSpent).toFixed(2)} · Referral ${Number(one.data.referralEarnings).toFixed(2)} · Code <code>{one.data.referralCode}</code></div></Card>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="+/- amount" type="number" step="0.01" value={delta} onChange={(e) => setDelta(e.target.value)} />
              <Button onClick={adjust}>Adjust</Button>
            </div>
            <Textarea placeholder="Mandatory reason…" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => ban(one.data.status !== 'BANNED')}>{one.data.status === 'BANNED' ? 'Unban' : 'Ban'}</Button>
              <Button variant="outline" onClick={async () => { await post(`/api/users/${sel}/reset-ref`, {}); toast('Referral code reset'); one.refetch(); }}>Reset ref code</Button>
            </div>
            <div><h3 className="font-bold">Referral tree ({one.data.referrals.length})</h3>
              {one.data.referrals.map((r) => <div key={r.telegramId} className="text-xs">• {r.firstName} <code>{r.telegramId}</code></div>)}</div>
            <div><h3 className="font-bold">Ledger</h3>
              {one.data.walletTxns.map((t) => <div key={t.id} className="flex justify-between border-b py-1 text-xs dark:border-slate-800">
                <span>{t.type} · {t.note}</span><b>{Number(t.amount) > 0 ? '+' : ''}{Number(t.amount).toFixed(2)}</b></div>)}</div>
          </div>
        ) : <Empty text="Not found" />}
      </Drawer>
    </div>
  );
}
