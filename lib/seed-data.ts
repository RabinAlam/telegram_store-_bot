export type BulkTier = { minQty: number; unitPrice: number };
export type SeedProduct = {
  id: string; categorySlug: string; title: string; desc: string;
  contents: string; priceUsdt: number; tiers: BulkTier[]; stock: number; status: 'ACTIVE' | 'OOS';
};
export const CATEGORIES = [
  { slug: 'github', name: 'GitHub', emoji: '🐙', sort: 1 , logo: '/logos/github.svg' },
  { slug: 'capcut', name: 'CapCut', emoji: '🎬', sort: 2 , logo: '/logos/capcut.svg' },
  { slug: 'grok', name: 'Grok', emoji: '🤖', sort: 3 , logo: '/logos/grok.svg' },
  { slug: 'canva', name: 'Canva', emoji: '🎨', sort: 4 , logo: '/logos/canva.svg' },
  { slug: 'chatgpt', name: 'ChatGPT', emoji: '💬', sort: 5 , logo: '/logos/chatgpt.svg' },
  { slug: 'gemini', name: 'Gemini', emoji: '✨', sort: 6 , logo: '/logos/gemini.svg' },
  { slug: 'claude', name: 'Claude', emoji: '🧠', sort: 7 , logo: '/logos/claude.svg' },
  { slug: 'email', name: 'Email', emoji: '📧', sort: 8 , logo: '/logos/email.svg' },
  { slug: 'tz-vip', name: 'TZ VIP', emoji: '👑', sort: 9 , logo: '/logos/tz-vip.svg' },
  { slug: 'youtube', name: 'YouTube', emoji: '▶️', sort: 10 , logo: '/logos/youtube.svg' },
  { slug: 'muse-ai', name: 'Muse AI', emoji: '♾️', sort: 11 , logo: '/logos/muse.svg' },
  { slug: 'telegram-premium', name: 'Telegram Premium', emoji: '✈️', sort: 12 , logo: '/logos/telegram-premium.svg' },
  { slug: 'figma', name: 'Figma', emoji: '🖌️', sort: 13 , logo: '/logos/figma.svg' },
  { slug: 'vpn', name: 'VPN', emoji: '🛡️', sort: 14 , logo: '/logos/vpn.svg' },
  { slug: 'duolingo', name: 'Duolingo', emoji: '🦉', sort: 15 , logo: '/logos/duolingo.svg' },
  { slug: 'leonardo', name: 'Leonardo AI', emoji: '🎭', sort: 16 , logo: '/logos/leonardo.svg' },
];
export const PRODUCTS: SeedProduct[] = [
  { id: 'p-github-student', categorySlug: 'github', title: 'GitHub Student Developer Pack', desc: 'The best developer tools, free for students. Get your GitHub Student Developer Pack now.', contents: 'Format: Email | Password | 2FA. 2FA Site: https://2fa.live. Account Validity: 2 Year. Full list: https://education.github.com/pack. Use IP: Bangladesh. You may change email and 2FA after 7 days.', priceUsdt: 10.0, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-capcut-1m', categorySlug: 'capcut', title: 'CapCut Pro Team 1M', desc: 'CapCut Pro team seat, 1 month.', contents: 'Login / team invite link. ETA: instant.', priceUsdt: 1.8, tiers: [{ minQty: 1, unitPrice: 1.8 }, { minQty: 5, unitPrice: 1.65 }], stock: 100, status: 'ACTIVE' },
  { id: 'p-grok-1m', categorySlug: 'grok', title: 'Grok Premium 1M', desc: 'Grok AI premium access, 1 month.', contents: 'Login credentials. ETA: instant.', priceUsdt: 4.5, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-canva-1m', categorySlug: 'canva', title: 'Canva Pro Team 1M', desc: 'Canva Pro team invite, 1 month.', contents: 'Team invite link. ETA: instant.', priceUsdt: 1.5, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-chatgpt-1m', categorySlug: 'chatgpt', title: 'ChatGPT Plus 1M', desc: 'ChatGPT Plus upgrade, 1 month.', contents: 'Invite / upgrade code. ETA: instant.', priceUsdt: 6.0, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-gemini-18m', categorySlug: 'gemini', title: 'Gemini 18 Months', desc: 'Gemini upgrade code, 18 months.', contents: 'Redeem code + steps. ETA: instant.', priceUsdt: 0.75, tiers: [{ minQty: 1, unitPrice: 0.75 }, { minQty: 6, unitPrice: 0.7 }, { minQty: 16, unitPrice: 0.65 }], stock: 100, status: 'ACTIVE' },
  { id: 'p-claude-1m', categorySlug: 'claude', title: 'Claude Pro 1M', desc: 'Claude Pro upgrade, 1 month.', contents: 'Login / redeem code. ETA: instant.', priceUsdt: 5.0, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-youtube-1m', categorySlug: 'youtube', title: 'YouTube Premium 1M', desc: 'YouTube Premium upgrade, 1 month.', contents: 'Family invite link. ETA: instant.', priceUsdt: 2.5, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-tz-vip-1m', categorySlug: 'tz-vip', title: 'TZ VIP 1M', desc: 'TZ Store VIP membership, priority delivery.', contents: 'VIP role + priority support. ETA: instant.', priceUsdt: 9.0, tiers: [], stock: 100, status: 'ACTIVE' },
  { id: 'p-vpn-12m', categorySlug: 'vpn', title: 'VPN 12 Months', desc: 'Private VPN key, 12 months, multi-device.', contents: 'VLESS subscription URL. ETA: instant.', priceUsdt: 12.0, tiers: [{ minQty: 1, unitPrice: 12 }, { minQty: 3, unitPrice: 11 }], stock: 100, status: 'ACTIVE' },
];
export function unitPriceFor(p: SeedProduct, qty: number) {
  let unit = p.priceUsdt;
  for (const t of [...p.tiers].sort((a, b) => a.minQty - b.minQty)) if (qty >= t.minQty) unit = t.unitPrice;
  return unit;
}
