import crypto from 'node:crypto';

// Server-side Binance check for the website deposit flow (personal account).
// Looks up the TxID in our Spot USDT deposit history. Returns:
// - { state: 'matched', amount }  -> credit/fulfill immediately
// - { state: 'not-found', checked } -> keep under review, user retries later
// - { state: 'no-keys' } -> manual review path (no Spot API configured)
export async function checkTxidOnBinance(
  txid: string,
  expectedAmount?: number,
): Promise<{ state: 'matched' | 'not-found' | 'no-keys'; amount?: number; checked?: number; reason: string }> {
  const key = process.env.BINANCE_SPOT_API_KEY ?? '';
  const secret = process.env.BINANCE_SPOT_SECRET ?? '';
  if (!key || !secret) return { state: 'no-keys', reason: 'Auto-check not configured — admin will verify manually.' };
  const needle = txid.trim().toLowerCase();
  try {
    const qs = new URLSearchParams({ coin: 'USDT', limit: '100', timestamp: String(Date.now()), recvWindow: '10000' }).toString();
    const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
    const r = await fetch(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${qs}&signature=${sig}`, {
      headers: { 'X-MBX-APIKEY': key },
    });
    if (!r.ok) return { state: 'not-found', checked: 0, reason: 'Binance API unreachable — try Check Status in a minute.' };
    const list = (await r.json()) as Array<{ amount: string; txId?: string; status?: number }>;
    const ok = (Array.isArray(list) ? list : []).filter((d) => d.status === undefined || d.status === 1);
    const hit = ok.find((d) => d.txId && (d.txId.toLowerCase().includes(needle) || needle.includes(d.txId.toLowerCase())));
    if (!hit) return { state: 'not-found', checked: ok.length, reason: `TxID not in recent deposits (checked ${ok.length}) — if just sent, wait a minute and retry.` };
    const amount = Number(hit.amount);
    if (expectedAmount !== undefined && Math.abs(amount - expectedAmount) > 0.011) {
      return { state: 'not-found', checked: ok.length, reason: `Found $${amount.toFixed(2)} but order needs $${expectedAmount.toFixed(2)} — admin will review.` };
    }
    return { state: 'matched', amount, reason: `Matched $${amount.toFixed(2)} on Binance.` };
  } catch {
    return { state: 'not-found', checked: 0, reason: 'Check failed — try again in a minute.' };
  }
}
