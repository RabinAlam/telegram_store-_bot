import crypto from 'crypto';
// Validates Telegram Mini App initData HMAC-SHA256 with bot token.
// initData: raw query string e.g. "user=...&auth_date=...&hash=..."
export function validateInitData(initData: string, botToken: string, maxAgeSec = 3600): { ok: boolean; user?: any; reason?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'missing hash' };
    params.delete('hash');
    const dataCheckString = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (calc !== hash) return { ok: false, reason: 'bad hash' };
    const authDate = Number(params.get('auth_date') ?? 0);
    if (maxAgeSec > 0 && Date.now() / 1000 - authDate > maxAgeSec) return { ok: false, reason: 'expired' };
    const userRaw = params.get('user');
    return { ok: true, user: userRaw ? JSON.parse(userRaw) : undefined };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? 'error' };
  }
}
export function parseStartParam(initData: string): string | null {
  try {
    const p = new URLSearchParams(initData);
    const sp = p.get('start_param') ?? p.get('startapp');
    return sp;
  } catch { return null; }
}
