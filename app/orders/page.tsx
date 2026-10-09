'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Card, PricePill, Skeleton } from '@/components/ui';
import { backButton, tzAuthHeader } from '@/lib/tma';
export default function Orders() {
  const router = useRouter();
  useEffect(() => backButton(() => router.back()), [router]);
  const { data, isLoading } = useQuery({ queryKey: ['mine'], queryFn: async () => (await fetch('/api/orders/mine', { headers: { ...tzAuthHeader() } })).json() });
  return (
    <main className="pt-4 space-y-2">
      <h1 className="text-lg font-bold">My Orders</h1>
      {isLoading ? (<><Skeleton className="h-16" /><Skeleton className="h-16" /></>) :
        (data?.orders ?? []).map((o: any) => (
          <Card key={o.id} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold">{o.productId} × {o.qty}</div>
              <div className="mt-1 flex items-center gap-2"><PricePill>${o.total}</PricePill>
                <span className="tight rounded-full bg-gray-100 px-2 py-0.5 text-xs">{o.status}</span></div>
              <div className="mt-1 text-xs text-gray-500">{o.id}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Link className="tight rounded-[10px] bg-gray-100 px-3 py-2 text-center text-sm font-semibold" href={`/success/${o.id}`}>View</Link>
              <Link className="tight rounded-[10px] bg-[#57C25E] px-3 py-2 text-center text-sm font-semibold text-white" href={`/p/${o.productId}`}>Reorder</Link>
            </div>
          </Card>
        ))}
      {(data?.orders ?? []).length === 0 && !isLoading && <Card><p className="text-sm">No orders yet. <Link className="text-[#4A90D9] underline" href="/home">Browse store</Link></p></Card>}
      <Link href="https://t.me/TZStoreSupport" className="block text-center text-sm text-[#4A90D9] underline">Support</Link>
      <button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
    </main>
  );
}
