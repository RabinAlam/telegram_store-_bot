import Link from 'next/link';
import { Card } from '@/components/ui';
export default function ApiInfo() {
  return (
    <main className="space-y-3 pt-4">
      <Card className="p-4">
        <h1 className="text-lg font-bold">🔑 Reseller API</h1>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li><code>GET /api/categories</code> — 16 categories with real logos</li>
          <li><code>GET /api/categories/[slug]/products</code></li>
          <li><code>POST /api/orders/quote</code> — qty → total</li>
          <li><code>POST /api/payments/intent</code> — STARS/BINANCE/TRC20/BEP20/BTC</li>
        </ul>
      </Card>
      <Link href="/home" className="block rounded-[14px] bg-red-500 px-4 py-3 text-center text-[15px] font-bold text-white">⬅️ Back</Link>
    </main>
  );
}
