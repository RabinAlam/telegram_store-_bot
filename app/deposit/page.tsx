'use client';
import Link from 'next/link';
import { Card } from '@/components/ui';
const METHODS = [
  { id: 'STARS', name: '⭐ Telegram Stars (Auto)', desc: '1-Tap in-app deposit' },
  { id: 'BINANCE', name: '🟡 Binance UID', desc: 'Zero fee internal transfer. UID: 1134278389' },
  { id: 'TRC20', name: '🅣 USDT TRC20 (Auto)', desc: 'On-chain instant credit' },
  { id: 'BEP20', name: '🅣 USDT BEP20 (Auto)', desc: 'On-chain instant credit' },
  { id: 'BTC', name: '🅑 Bitcoin (Auto)', desc: 'On-chain instant credit' },
];
export default function Deposit() {
  return (
    <main className="space-y-3 pt-4">
      <Card className="p-4">
        <h1 className="text-lg font-bold">💳 Select a payment method:</h1>
        <p className="mt-1 text-sm text-gray-600">⚡ All deposit methods are auto-detected &amp; instant.</p>
      </Card>
      {METHODS.map((m) => (
        <Link key={m.id} href={`/orders`} className="block rounded-[14px] bg-[#4A90D9] px-4 py-3.5 text-center text-[15px] font-bold text-white">
          {m.name}
          <span className="block text-xs font-normal opacity-80">{m.desc}</span>
        </Link>
      ))}
      <p className="text-center text-xs text-gray-500">Create an order first — deposit is linked to your order intent with 20-min expiry.</p>
      <Link href="/home" className="block rounded-[14px] bg-red-500 px-4 py-3 text-center text-[15px] font-bold text-white">⬅️ Back</Link>
    </main>
  );
}
