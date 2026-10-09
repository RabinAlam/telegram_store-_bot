// Pure settings-display helpers (unit tested). Keeps inputs easy to use:
// blanks stay blank, legacy '""' junk shows blank, masks never leak into inputs.
export const SECRET_KEYS = new Set([
  'botToken', 'binanceApiKey', 'binanceSecret', 'binanceSpotApiKey', 'binanceSpotSecret',
]);

export const SECRET_MASK = '••••••';

export function displaySettingValue(
  form: Record<string, string>,
  server: Record<string, unknown>,
  key: string,
): string {
  if (form[key] !== undefined) return form[key];
  const v = server[key];
  if (v === undefined || v === null) return '';
  if (v === '""' || v === "''") return '';
  if (typeof v === 'string') return SECRET_KEYS.has(key) && v === SECRET_MASK ? '' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

export function secretPlaceholder(serverValue: unknown): string {
  return serverValue === SECRET_MASK ? '•••••• saved — leave blank to keep' : 'Paste new value…';
}

// True when a secret field should NOT be sent (blank = keep saved value).
export function shouldSkipSecret(key: string, raw: string): boolean {
  return SECRET_KEYS.has(key) && (raw === '' || raw === SECRET_MASK);
}

// Normalize raw input before PUT: legacy quote junk becomes ''.
export function normalizeSettingInput(raw: string): string {
  return raw === '""' || raw === "''" ? '' : raw;
}
