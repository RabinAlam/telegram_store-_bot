import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store';
import { del, get, post } from '../api';
import { Badge, Button, Card, Empty, Field, Input, Select, Skeleton, toast } from '../ui';

type Admin = { id: string; email: string; role: string; lastLoginAt?: string; createdAt: string };
type Log = { id: string; action: string; entity: string; entityId: string; createdAt: string; admin?: { email: string } };

export default function AdminsAudit() {
  const me = useStore((s) => s.admin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SUPPORT');
  const [action, setAction] = useState('');
  const admins = useQuery({ queryKey: ['admins'], queryFn: () => get('/api/admins') as Promise<Admin[]>, enabled: me?.role === 'SUPER_ADMIN' });
  const logs = useQuery({ queryKey: ['audit', action], queryFn: () => get(`/api/audit?${new URLSearchParams(action ? { action } : {})}`) as Promise<{ items: Log[] }> });

  async function create() {
    try {
      await post('/api/admins', { email, password, role });
      toast('Admin created'); setEmail(''); setPassword(''); admins.refetch();
    } catch (e) { toast(e instanceof Error ? e.message : 'failed'); }
  }

  return (
    <div className="space-y-4">
      {me?.role === 'SUPER_ADMIN' ? (
        <Card>
          <h2 className="font-bold">Admin accounts</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value)}><option>SUPER_ADMIN</option><option>MANAGER</option><option>SUPPORT</option></Select></Field>
            <div className="flex items-end"><Button onClick={create} className="w-full">Create</Button></div>
          </div>
          <table className="mt-3 w-full text-sm"><tbody>
            {(admins.data ?? []).map((a) => <tr key={a.id} className="border-t dark:border-slate-800">
              <td className="p-2 font-semibold">{a.email}</td>
              <td className="p-2"><Badge tone={a.role === 'SUPER_ADMIN' ? 'red' : 'blue'}>{a.role}</Badge></td>
              <td className="p-2 text-right"><Button variant="danger" onClick={async () => { await del(`/api/admins/${a.id}`); toast('Removed'); admins.refetch(); }}>Remove</Button></td>
            </tr>)}
          </tbody></table>
        </Card>
      ) : <Card><p className="text-sm">403 — Admin management is SUPER_ADMIN only.</p></Card>}
      <Card>
        <div className="mb-2 flex items-center gap-2"><h2 className="font-bold">Audit log</h2><div className="flex-1" />
          <Input placeholder="Filter action…" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-48" /></div>
        {logs.isLoading ? <Skeleton className="h-48" /> : !logs.data?.items.length ? <Empty text="No audit entries" /> : (
          <table className="w-full text-xs"><tbody>
            {logs.data.items.map((l) => <tr key={l.id} className="border-t dark:border-slate-800">
              <td className="p-2 text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="p-2 font-semibold">{l.action}</td>
              <td className="p-2 font-mono">{l.entity}/{l.entityId}</td>
              <td className="p-2 text-right">{l.admin?.email}</td></tr>)}
          </tbody></table>)}
      </Card>
    </div>
  );
}
