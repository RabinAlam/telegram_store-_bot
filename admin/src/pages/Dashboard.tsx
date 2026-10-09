import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ReceiptText, UserPlus, Hourglass, Activity } from 'lucide-react';
import { Badge, Card } from '../ui';

// Demo data only — dashboard never hits the API.
const DEMO_REVENUE_30 = [
  { date: 'W1', revenue: 1240 }, { date: 'W2', revenue: 1860 }, { date: 'W3', revenue: 1490 },
  { date: 'W4', revenue: 2320 }, { date: 'W5', revenue: 1980 }, { date: 'W6', revenue: 2740 },
];
const DEMO_REVENUE_7 = DEMO_REVENUE_30.slice(-7);
const DEMO_REVENUE_90 = [
  ...DEMO_REVENUE_30,
  { date: 'W7', revenue: 2410 }, { date: 'W8', revenue: 2890 }, { date: 'W9', revenue: 3120 },
  { date: 'W10', revenue: 2760 }, { date: 'W11', revenue: 3340 }, { date: 'W12', revenue: 3580 },
];
const DEMO_TOP = [
  { name: 'ChatGPT Plus', revenue: 4820, count: 320 },
  { name: 'Telegram Premium', revenue: 3650, count: 410 },
  { name: 'Canva Pro', revenue: 2980, count: 510 },
  { name: 'CapCut Pro', revenue: 2140, count: 620 },
  { name: 'VPN 1M', revenue: 1760, count: 290 },
];
const DEMO_DONUT = [
  { status: 'PAID', count: 1240 },
  { status: 'PENDING', count: 180 },
  { status: 'FAILED', count: 45 },
  { status: 'REFUNDED', count: 30 },
];
const DEMO_RECENT = [
  { id: '1', orderNo: 'TZ-8F3K2A', amountUsdt: 12.5, paymentStatus: 'PAID' },
  { id: '2', orderNo: 'TZ-9H2M5Q', amountUsdt: 4.99, paymentStatus: 'PAID' },
  { id: '3', orderNo: 'TZ-2X7P4L', amountUsdt: 29.0, paymentStatus: 'PENDING' },
  { id: '4', orderNo: 'TZ-5T9R1W', amountUsdt: 7.5, paymentStatus: 'PAID' },
  { id: '5', orderNo: 'TZ-6Y4N8B', amountUsdt: 15.0, paymentStatus: 'REFUNDED' },
];

const COLORS = ['#4A90D9', '#57C25E', '#F59E0B', '#D6365B', '#8B5CF6'];

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const revenueSeries = days === 7 ? DEMO_REVENUE_7 : days === 90 ? DEMO_REVENUE_90 : DEMO_REVENUE_30;
  const cards = [
    { label: 'Today Revenue', value: '$1,284.50', Icon: DollarSign },
    { label: 'Orders Today', value: '86', Icon: ReceiptText },
    { label: 'New Users', value: '132', Icon: UserPlus },
    { label: 'Pending Deposits', value: '7', Icon: Hourglass },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><Activity size={20} /> Dashboard</h1>
        <span className="ml-3 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Demo data</span>
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
            <div className="mt-1 text-2xl font-extrabold">{c.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Revenue ({days}d) — demo</h2>
          <div className="h-56">
            <ResponsiveContainer><LineChart data={revenueSeries}><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="revenue" stroke="#4A90D9" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Top 5 products — demo</h2>
          <div className="h-56">
            <ResponsiveContainer><BarChart data={DEMO_TOP} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="revenue" fill="#57C25E" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-bold">Payment status — demo</h2>
          <div className="h-52">
            <ResponsiveContainer><PieChart><Pie data={DEMO_DONUT} dataKey="count" nameKey="status" outerRadius={80} label>
              {DEMO_DONUT.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">Recent orders — demo</h2><Link to="/orders" className="text-sm text-blue-600">View all</Link></div>
          <table className="w-full text-sm">
            <tbody>
              {DEMO_RECENT.map((o) => (
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
        <h2 className="flex items-center gap-2 font-bold"><Activity size={17} /> Bot health — demo</h2>
        <p className="mt-1 text-sm">Webhook: <Badge tone="green">CONFIGURED</Badge> <span className="text-slate-400">·</span> Last webhook: demo 2 min ago (PAID)</p>
      </Card>
    </div>
  );
}
