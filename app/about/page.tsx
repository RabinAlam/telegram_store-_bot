import Link from 'next/link';
import { Card } from '@/components/ui';
export default function About() {
  return (
    <main className="space-y-3 pt-4">
      <Card className="p-4">
        <h1 className="text-lg font-bold">🔎 About TZ Store</h1>
        <p className="mt-1 text-sm text-gray-600">Instant digital goods — GitHub, AI tools, VPN, premium subs. Same flow as Telegram bot: Products → quantity → order → 5 payments → auto-delivery.</p>
        <p className="mt-2 text-sm">🎧 Support: <a className="text-[#4A90D9] underline" href="https://t.me/TZStoreSupport">TZStoreSupport</a></p>
        <p className="text-sm">📣 Channel: <a className="text-[#4A90D9] underline" href="https://t.me/TZStoreChannel">TZStoreChannel</a></p>
      </Card>
      <Link href="/home" className="block rounded-[14px] bg-red-500 px-4 py-3 text-center text-[15px] font-bold text-white">⬅️ Back</Link>
    </main>
  );
}
