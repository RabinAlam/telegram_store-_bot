import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../api';
import { Button, Card, Empty, Input, Select, Skeleton, Textarea, toast } from '../ui';

type Bc = { id: string; title: string; text: string; targetType: string; sentCount: number; status: string; createdAt: string };

export default function Broadcast() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [segment, setSegment] = useState('all');
  const [lastId, setLastId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['bc'], queryFn: () => get('/api/broadcasts') as Promise<Bc[]> });

  async function create() {
    try {
      const b = (await post('/api/broadcasts', { title, text, targetType: 'ALL' })) as Bc;
      setLastId(b.id); toast('Draft created'); list.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  async function send() {
    if (!lastId) return;
    await post(`/api/broadcasts/${lastId}/send`, { segment });
    toast('Queued for sending'); list.refetch();
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <h2 className="font-bold">Compose broadcast</h2>
        <div className="mt-2 space-y-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={5} placeholder="Message text (HTML allowed)…" value={text} onChange={(e) => setText(e.target.value)} />
          <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="all">Target: ALL</option><option value="active7d">Active 7d</option>
            <option value="buyers">Buyers</option><option value="neverBought">Never bought</option>
          </Select>
          <div className="flex gap-2"><Button onClick={create}>Save draft</Button>
          <Button variant="green" onClick={send} disabled={!lastId}>Send {segment}</Button></div>
        </div>
        <h3 className="mb-1 mt-4 font-bold">History</h3>
        {list.isLoading ? <Skeleton className="h-24" /> : !list.data?.length ? <Empty text="No broadcasts" /> : (
          <table className="w-full text-xs"><tbody>
            {list.data.map((b) => <tr key={b.id} className="border-t dark:border-slate-800">
              <td className="p-2 font-semibold">{b.title} <span className="text-slate-500">[{b.status}]</span></td>
              <td className="p-2 text-right"><div className="h-2 w-24 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, b.sentCount)}%` }} /></div>
                <span>{b.sentCount} sent</span></td></tr>)}
          </tbody></table>)}
      </Card>
      <Card>
        <h2 className="mb-2 font-bold">Telegram preview</h2>
        <div className="mx-auto max-w-xs rounded-2xl bg-[#d8f5d0] p-3 text-sm shadow dark:bg-[#1a3a2a]">
          <p className="font-bold">{title || 'Title…'}</p>
          <p className="mt-1 whitespace-pre-wrap">{text || 'Message preview renders here like a Telegram bubble…'}</p>
          <p className="mt-1 text-right text-[11px] text-slate-500">04:23 PM ✓✓</p>
        </div>
      </Card>
    </div>
  );
}
