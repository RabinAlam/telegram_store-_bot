import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ReceiptText, UserPlus, Hourglass, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { Badge, Card, Skeleton } from '../ui';

type DashboardData = {
  kpis: { todayRevenue: number; ordersToday: number; newUsers: number; pendingDeposits: number };
  revenueSeries: Array<{ date: string; revenue: number }>;
  topProducts: Array<{ name: string; revenue: number; count: number }>;
  paymentDonut: Array<{ status: string; count: number }>;
  recentOrders: Array<{ id: string; orderNo: string; amountUsdt: number; paymentStatus: string }>;
  botHealth: { webhookConfigured: boolean; lastWebhookAt: string | null; lastWebhookStatus: string | null };
};

const DEMO_REVENUE = [
  { date: 'Day 1', revenue: 120 }, { date: 'Day 2', revenue: 240 }, { date: 'Day 3', revenue: 310 },
  { date: 'Day 4', revenue: 180 }, { date: 'Day 5', revenue: 420 }, { date: 'Day 6', revenue: 390 }, { date: 'Day 7', revenue: 510 },
];
const DEMO_TOP = [
  { name: 'ChatGPT Plus', revenue: 480, count: 32 },
  { name: 'Telegram Premium', revenue: 360, count: 41 },
  { name: 'Canva Pro', revenue: 290, count: 51 },
];
const DEMO_DONUT = [
  { status: 'PAID', count: 12 }, { status: 'PENDING', count: 2 },
];
const DEMO_RECENT = [
  { id: '1', orderNo: 'TZ-DEMO1', amountUsdt: 12.5, paymentStatus: 'PAID' },
  { id: '2', orderNo: 'TZ-DEMO2', amountUsdt: 4.99, paymentStatus: 'PENDING' },
];

const COLORS = ['#4A90D9', '#57C25E', '#F59E0B', '#D6365B', '#8B5CF6'];

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', days],
    queryFn: () => get(`/api/dashboard?days=${days}`) as Promise<DashboardData>,
    refetchInterval: 30000,
  });

  const isLive = Boolean(data);
  const revenueSeries = data?.revenueSeries?.length ? data.revenueSeries : DEMO_REVENUE;
  const topProducts = data?.topProducts?.length ? data.topProducts : DEMO_TOP;
  const paymentDonut = data?.paymentDonut?.length ? data.paymentDonut : DEMO_DONUT;
  const recentOrders = data?.recentOrders?.length ? data.recentOrders : DEMO_RECENT;

  const cards = [
    { label: 'Today Revenue', value: data ? `$${Number(data.kpis.todayRevenue).toFixed(2)}` : '$0.00', Icon: DollarSign },
    { label: 'Orders Today', value: data ? String(data.kpis.ordersToday) : '0', Icon: ReceiptText },
    { label: 'New Users', value: data ? String(data.kpis.newUsers) : '0', Icon: UserPlus },
    { label: 'Pending Deposits', value: data ? String(data.kpis.pendingDeposits) : '0', Icon: Hourglass },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><Activity size={20} /> Dashboard</h1>
        <span className={`ml-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {isLive ? '🟢 Live' : 'Demo data'}
        </span>
        <div className="flex-1" />
        <div className="flex gap-1 rounded-xl bg-white p-1 dark:bg-slate-900">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${days === d ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {d}D</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <div className="flex items-center gap-2 text-slate-500"><c.Icon size={18} /><span className="text-xs font-medium">{c.label}</span></div>
            <div className="mt-1 text-2xl font-extrabold">{isLoading ? <Skeleton className="h-8 w-24" /> : c.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Revenue ({days}d)</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={revenueSeries}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#4A90D9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Top products</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={topProducts} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#57C25E" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Payment status</h2>
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={paymentDonut} dataKey="count" nameKey="status" outerRadius={80} label>
                  {paymentDonut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Recent orders</h2>
            <Link to="/orders" className="text-sm text-blue-600">View all</Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-mono text-xs">{o.orderNo}</td>
                  <td className="py-2 text-right font-semibold">${Number(o.amountUsdt).toFixed(2)}</td>
                  <td className="py-2 text-right"><Badge tone={o.paymentStatus === 'PAID' ? 'green' : 'amber'}>{o.paymentStatus}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Card>
        <h2 className="flex items-center gap-2 font-bold"><Activity size={17} /> Bot & Webhook Health</h2>
        <p className="mt-1 text-sm">
          Webhook: <Badge tone={data?.botHealth?.webhookConfigured ? 'green' : 'amber'}>{data?.botHealth?.webhookConfigured ? 'CONFIGURED' : 'NOT SET'}</Badge>
          <span className="mx-2 text-slate-400">·</span>
          Last webhook: {data?.botHealth?.lastWebhookAt ? `${new Date(data.botHealth.lastWebhookAt).toLocaleTimeString()} (${data.botHealth.lastWebhookStatus})` : 'None yet'}
        </p>
      </Card>
    </div>
  );
}
