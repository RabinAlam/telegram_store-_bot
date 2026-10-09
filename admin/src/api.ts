// Typed fetch client with JWT access + refresh rotation.
const BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '';

function tokens() {
  return {
    access: localStorage.getItem('tz_access') ?? '',
    refresh: localStorage.getItem('tz_refresh') ?? '',
  };
}

async function refreshAccess(): Promise<string | null> {
  const { refresh } = tokens();
  if (!refresh) return null;
  const r = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  localStorage.setItem('tz_access', j.accessToken);
  return j.accessToken as string;
}

export async function api(path: string, opts: RequestInit = {}, retry = true): Promise<unknown> {
  const { access } = tokens();
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(access ? { authorization: `Bearer ${access}` } : {}), ...(opts.headers ?? {}) },
  });
  if (r.status === 401 && retry) {
    const next = await refreshAccess();
    if (next) return api(path, { ...opts, headers: { ...(opts.headers ?? {}), authorization: `Bearer ${next}` } }, false);
    localStorage.removeItem('tz_access');
    localStorage.removeItem('tz_refresh');
    if (location.pathname !== '/login') location.href = '/login';
    throw new Error('session expired');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `request failed (${r.status})`);
  }
  return r.json();
}

export const get = (p: string) => api(p) as Promise<never>;
export const post = (p: string, body: unknown) => api(p, { method: 'POST', body: JSON.stringify(body) }) as Promise<never>;
export const patch = (p: string, body: unknown) => api(p, { method: 'PATCH', body: JSON.stringify(body) }) as Promise<never>;
export const del = (p: string) => api(p, { method: 'DELETE' }) as Promise<never>;
