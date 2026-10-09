'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, Skeleton } from '@/components/ui';
import { backButton, haptic } from '@/lib/tma';
export default function Feed() {
  const router = useRouter();
  useEffect(() => backButton(() => router.back()), [router]);
  const { data, isLoading } = useQuery({ queryKey: ['feed'], queryFn: async () => (await fetch('/api/feed/restocks')).json() });
  return (
    <main className="pt-4 space-y-2">
      <h1 className="text-lg font-bold">🎁 Restock feed</h1>
      {isLoading ? (<><Skeleton className="h-24" /><Skeleton className="h-24" /></>) :
        (data?.restocks ?? []).map((r: any) => (
          <Card key={r.id} className="border-l-4 border-l-[#57C25E]">
            <p className="text-sm font-medium">🎁 Restocked!</p>
            <p className="text-sm">{r.message}</p>
            <p className="mt-1 text-xs text-gray-500">✅ Available: {r.qty}</p>
            <Link href={`/p/${r.productId}`} onClick={() => haptic('light')} className="mt-2 block rounded-[12px] bg-[#57C25E] px-4 py-3 text-center font-semibold text-white">Buy Now</Link>
          </Card>
        ))}
      <button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
    </main>
  );
}
