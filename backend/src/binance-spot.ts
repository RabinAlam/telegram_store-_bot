// Personal Binance account verification (NO merchant account needed).
// Flow: user sends USDT to the store's personal Binance UID (internal transfer)
// or on-chain to a deposit address, then submits the Binance Order ID / TxID.
// We verify with the regular Binance Spot API (HMAC-SHA256, api.binance.com):
//   GET /sapi/v1/capital/deposit/hisrec  -> on-chain USDT deposits
// and match by amount (+ txId when the user provided one).
// Internal UID-to-UID transfers are NOT visible via any public API, so for those
// the panel keeps manual approve as fallback (admin checks the Binance app).
import crypto from 'node:crypto';

const SPOT_BASE = 'https://api.binance.com';

// Binance Spot signature: HMAC-SHA256(queryString) as lowercase hex.
export function signSpot(queryString: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

export type SpotDeposit = {
  amount: string;
  coin: string;
  txId?: string;
  status?: number; // 1 = success
  insertTime?: number;
};

export async function spotGet<T>(path: string, params: Record<string, string>, apiKey: string, secret: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: '10000' }).toString();
  const signature = signSpot(qs, secret);
  const r = await fetch(`${SPOT_BASE}${path}?${qs}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  if (!r.ok) throw new Error(`binance spot ${r.status}`);
  return (await r.json()) as T;
}

export async function getDepositHistory(apiKey: string, secret: string, coin = 'USDT'): Promise<SpotDeposit[]> {
  if (!apiKey || !secret) throw new Error('spot api keys not configured');
  return spotGet<SpotDeposit[]>('/sapi/v1/capital/deposit/hisrec', { coin }, apiKey, secret);
}

// Pure matcher — unit tested. Amount tolerance 0.01 USDT.
export function matchDeposit(
  deposits: SpotDeposit[],
  expected: { amount: number; txid?: string },
): { matched: boolean; deposit?: SpotDeposit; reason: string } {
  if (!deposits.length) return { matched: false, reason: 'no deposits found on account' };
  const ok = deposits.filter((d) => d.status === undefined || d.status === 1);
  const byAmount = ok.filter((d) => Math.abs(Number(d.amount) - expected.amount) < 0.011);
  if (!byAmount.length) {
    const seen = ok.slice(0, 5).map((d) => d.amount).join(', ');
    return { matched: false, reason: `no deposit of $${expected.amount.toFixed(2)} found (recent: ${seen || 'none'})` };
  }
  if (expected.txid) {
    const tx = expected.txid.trim().toLowerCase();
    const hit = byAmount.find((d) => (d.txId ?? '').toLowerCase().includes(tx) || tx.includes((d.txId ?? '').toLowerCase()));
    if (!hit) return { matched: false, reason: 'amount matches but TXID not found — check the ID or approve manually' };
    return { matched: true, deposit: hit, reason: `matched $${hit.amount} tx ${hit.txId}` };
  }
  // No TXID given: match only if exactly one candidate (avoid crediting the wrong payment)
  if (byAmount.length > 1) return { matched: false, reason: `${byAmount.length} deposits of this amount — ask user for TXID` };
  return { matched: true, deposit: byAmount[0], reason: `matched $${byAmount[0].amount}` };
}
