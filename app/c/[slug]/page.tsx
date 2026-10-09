'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, PricePill, StockBadge, Skeleton, CatLogo } from '@/components/ui';
import { backButton, haptic } from '@/lib/tma';
export default function Category({ params }: { params: { slug: string } }) {
  const router = useRouter();
  useEffect(() => backButton(() => router.back()), [router]);
  const { data, isLoading } = useQuery({ queryKey: ['cat', params.slug], queryFn: async () => (await fetch(`/api/categories/${params.slug}/products`)).json() });
  return (
    <main className="pt-4 space-y-2">
      <h1 className="text-lg font-bold capitalize">{params.slug.replace('-', ' ')}</h1>
      {isLoading ? (<><Skeleton className="h-16" /><Skeleton className="h-16" /></>) :
        (data?.products ?? []).map((p: any) => (
          <Link key={p.id} href={`/p/${p.id}`} onClick={() => haptic('light')}>
            <Card className="flex items-center gap-3 tg-press">
              <CatLogo logo={(p as any).logo} emoji="📦" name={p.title} size={36} />
              <div className="flex-1">
                <div className="font-semibold text-[15px]">{p.title} {p.stock <= 0 && <span className="text-gray-400">(out of stock)</span>}</div>
                <div className="mt-1 flex items-center gap-2"><PricePill>${p.priceUsdt.toFixed(2)}</PricePill><StockBadge stock={p.stock} />
                  {p.tiers?.length > 0 && <span className="tight rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">bulk −save</span>}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      {(data?.products ?? []).length === 0 && !isLoading && <Card><p className="text-sm text-gray-500">No products yet.</p></Card>}
      <button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
    </main>
  );
}
