import crypto from 'crypto';

// Vault credential encryption (AES-256-GCM, CODES_ENC_KEY base64 32B).
// Format: gcm:<iv b64>:<ciphertext b64>:<tag b64>
export function vaultEncrypt(plain: string): string {
  const b64key = process.env.CODES_ENC_KEY ?? '';
  if (!b64key) return `plain:${plain}`;
  try {
    const key = Buffer.from(b64key, 'base64');
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return `gcm:${iv.toString('base64')}:${ct.toString('base64')}:${c.getAuthTag().toString('base64')}`;
  } catch {
    return 'enc-error';
  }
}

export function vaultDecrypt(stored: string): string {
  if (stored.startsWith('plain:')) return stored.slice(6);
  const b64key = process.env.CODES_ENC_KEY ?? '';
  const m = /^gcm:([^:]+):([^:]+):([^:]+)$/.exec(stored);
  if (!m || !b64key) return stored;
  try {
    const key = Buffer.from(b64key, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(m[1], 'base64'));
    d.setAuthTag(Buffer.from(m[3], 'base64'));
    return Buffer.concat([d.update(Buffer.from(m[2], 'base64')), d.final()]).toString('utf8');
  } catch {
    return stored;
  }
}
