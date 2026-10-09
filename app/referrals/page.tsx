import Link from 'next/link';
import { Card } from '@/components/ui';
export default function Referrals() {
  return (
    <main className="space-y-3 pt-4">
      <Card className="p-4">
        <h1 className="text-lg font-bold">🎁 Referrals</h1>
        <p className="mt-1 text-sm text-gray-600">Share your link — earn commission on every referred purchase.</p>
        <p className="mt-2 rounded-lg bg-gray-100 p-2 text-sm">https://t.me/TZStoreBot?start=ref_YOURID</p>
        <p className="mt-2 text-sm">💳 Referral Earnings: $0.00</p>
      </Card>
      <Link href="/home" className="block rounded-[14px] bg-red-500 px-4 py-3 text-center text-[15px] font-bold text-white">⬅️ Back</Link>
    </main>
  );
}
