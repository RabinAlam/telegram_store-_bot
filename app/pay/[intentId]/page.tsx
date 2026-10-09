'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Card, Toast, PrimaryButton } from '@/components/ui';
import { backButton, haptic, tzAuthHeader } from '@/lib/tma';
export default function Pay({ params }: { params: { intentId: string } }) {
  const router = useRouter();
  const [intent, setIntent] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [secs, setSecs] = useState(30 * 60);
  const [txid, setTxid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => backButton(() => router.back()), [router]);
  useEffect(() => {
    let stop = false;
    async function poll() {
      const r = await fetch(`/api/payments/intent/${params.intentId}/status`, { headers: { ...tzAuthHeader() } });
      const j = await r.json();
      if (stop) return;
      setIntent(j.intent);
      if (j.intent?.status === 'FULFILLED' || j.intent?.status === 'CONFIRMED') { haptic('success'); router.push(`/success/${j.intent.orderId}`); return; }
      if (j.intent?.status === 'CANCELLED' || j.intent?.status === 'EXPIRED') return;
      setTimeout(poll, 3000);
    }
    poll();
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => { stop = true; clearInterval(t); };
  }, [params.intentId, router]);
  async function cancel() {
    const r = await fetch(`/api/payments/intent/${params.intentId}/cancel`, { method: 'POST', headers: { ...tzAuthHeader() } });
    const j = await r.json();
    haptic('warning'); setToast(j.message ?? '❌ Deposit cancelled');
    setIntent(j.intent);
  }
  function copy(t: string) { navigator.clipboard?.writeText(t); setToast('Copied'); }
  async function refreshOnce() {
    const r = await fetch(`/api/payments/intent/${params.intentId}/status`, { headers: { ...tzAuthHeader() } });
    const j = await r.json();
    setIntent(j.intent);
    if (j.intent?.status === 'FULFILLED' || j.intent?.status === 'CONFIRMED') { haptic('success'); router.push(`/success/${j.intent.orderId}`); }
    return j.intent;
  }
  async function submitTxid() {
    if (txid.trim().length < 6) { setToast('Enter your Binance Order ID / TxID (6+ chars)'); return; }
    setSubmitting(true);
    haptic('light');
    try {
      const r = await fetch(`/api/payments/intent/${params.intentId}/txid`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...tzAuthHeader() }, body: JSON.stringify({ txid: txid.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { setToast(j.error ?? 'Submit failed'); haptic('error'); return; }
      setToast(j.message ?? 'Submitted');
      if (j.state === 'matched') { haptic('success'); router.push(`/success/${j.intent.orderId}`); return; }
      setIntent(j.intent);
    } finally { setSubmitting(false); }
  }
  async function checkStatus() {
    setChecking(true);
    try {
      const it = await refreshOnce();
      // Re-run auto-check in case funds just landed
      if (it?.txHash && (it.status === 'PENDING' || it.status === 'NEEDS_REVIEW')) {
        const r = await fetch(`/api/payments/intent/${params.intentId}/txid`, {
          method: 'POST', headers: { 'content-type': 'application/json', ...tzAuthHeader() }, body: JSON.stringify({ txid: it.txHash }),
        });
        const j = await r.json();
        if (j.state === 'matched') { haptic('success'); router.push(`/success/${j.intent.orderId}`); return; }
        setToast(j.message ?? `Status: ${j.intent?.status ?? it.status}`);
        setIntent(j.intent ?? it);
      } else {
        setToast(`Status: ${it?.status ?? '…'}`);
      }
    } finally { setChecking(false); }
  }
  if (!intent) return <main className="pt-4"><Card>Loading payment…</Card></main>;
  const mm = Math.floor(secs / 60); const ss = String(secs % 60).padStart(2, '0');
  return (
    <main className="pt-4 space-y-3">
      <Card>
        <div className="font-bold">{intent.provider === 'STARS' ? '⭐ Telegram Stars' : intent.asset} payment</div>
        <p className="mt-1 text-sm">Amount: <b>{intent.amount} {intent.asset}</b></p>
        {intent.provider === 'BINANCE' && (
          <p className="mt-2 rounded-[10px] bg-blue-50 p-2.5 text-sm">📩 Send to store UID: <b><code>{process.env.NEXT_PUBLIC_BINANCE_UID ?? '1134278389'}</code></b>{' '}
            <button className="tight ml-1 text-[#4A90D9] underline" onClick={() => copy(process.env.NEXT_PUBLIC_BINANCE_UID ?? '1134278389')}>Copy</button>
            <span className="block text-xs text-gray-500">Your UID: {intent.address} (for verification)</span></p>
        )}
        {intent.address && intent.provider !== 'BINANCE' && <p className="mt-1 break-all text-sm">Address/UID: <b>{intent.address}</b> <button className="tight ml-2 text-[#4A90D9] underline" onClick={() => copy(intent.address)}>Copy</button></p>}
        {intent.memo && <p className="mt-1 break-all text-sm">Memo: <b>{intent.memo}</b> <button className="tight ml-2 text-[#4A90D9] underline" onClick={() => copy(intent.memo)}>Copy</button></p>}
        {intent.address && intent.provider !== 'BINANCE' && (
          <div className="mt-3 flex justify-center bg-white p-3"><QRCodeSVG value={`${intent.address}?amount=${intent.amount}&memo=${intent.memo ?? ''}`} size={180} /></div>
        )}
        <p className="mt-2 text-xs text-gray-500">⏳ Waiting for confirmation… {mm}:{ss} • polling every 3s</p>
        <p className="text-xs text-gray-500">Status: <b>{intent.status}</b>{intent.txHash ? <> · TxID: <code>{intent.txHash}</code></> : null}</p>
      </Card>
      {(intent.status === 'PENDING' || intent.status === 'NEEDS_REVIEW') && (
        <Card>
          <p className="text-sm font-bold">📝 Submit TxID / Order ID</p>
          <p className="mt-0.5 text-xs text-gray-500">After sending, paste your Binance Order ID / TxID — auto-checked instantly.</p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label="Binance Order ID or TxID"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder="Paste Order ID / TxID…"
              className="w-full rounded-[12px] border border-gray-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-[#4A90D9]"
            />
          </div>
          <button onClick={submitTxid} disabled={submitting} className="mt-2 w-full rounded-[14px] bg-[#57C25E] px-4 py-3 text-[15px] font-bold text-white transition tg-press disabled:opacity-50">
            {submitting ? '🔍 Checking on Binance…' : '📝 Submit TxID / Order ID'}
          </button>
          <button onClick={checkStatus} disabled={checking} className="mt-2 w-full rounded-[14px] bg-[#4A90D9] px-4 py-3 text-[15px] font-bold text-white transition tg-press disabled:opacity-50">
            {checking ? '🔄 Checking…' : '🔄 Check Status'}
          </button>
        </Card>
      )}
      {(intent.status === 'CANCELLED' || intent.status === 'EXPIRED') && (
        <Card><p className="font-semibold text-[#D6365B]">❌ Deposit cancelled</p><div className="mt-2"><PrimaryButton onClick={() => router.push('/home')}>Return to Menu</PrimaryButton></div></Card>
      )}
      {intent.status === 'PENDING' && <button onClick={cancel} className="w-full rounded-[14px] bg-[#D6365B] px-4 py-3 font-semibold text-white">Cancel deposit</button>}
      <button onClick={() => router.back()} className="w-full rounded-[14px] bg-red-500 px-4 py-3 text-[15px] font-bold text-white">⬅️ Back</button>
      <Toast msg={toast} />
    </main>
  );
}
