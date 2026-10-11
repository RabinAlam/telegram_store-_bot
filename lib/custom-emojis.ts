import fs from 'node:fs';
import path from 'node:path';

const EMOJI_FILE = path.resolve(process.cwd(), '.custom-emojis.json');

// Default / fallback registry
let emojiMap: Record<string, string> = {
  // Brand categories
  github: process.env.EMOJI_GITHUB || '',
  capcut: process.env.EMOJI_CAPCUT || '',
  grok: process.env.EMOJI_GROK || '',
  canva: process.env.EMOJI_CANVA || '',
  chatgpt: process.env.EMOJI_CHATGPT || '',
  loveable: process.env.EMOJI_LOVEABLE || '',
  gemini: process.env.EMOJI_GEMINI || '',
  claude: process.env.EMOJI_CLAUDE || '',
  email: process.env.EMOJI_EMAIL || '',
  'tz-vip': process.env.EMOJI_TZ_VIP || '',
  youtube: process.env.EMOJI_YOUTUBE || '',
  'muse-ai': process.env.EMOJI_MUSE_AI || '',
  'telegram-premium': process.env.EMOJI_TG_PREM || '',
  figma: process.env.EMOJI_FIGMA || '',
  vpn: process.env.EMOJI_VPN || '',
  duolingo: process.env.EMOJI_DUOLINGO || '',
  leonardo: process.env.EMOJI_LEONARDO || '',

  // Main UI buttons
  products: process.env.EMOJI_PRODUCTS || '',
  deposit: process.env.EMOJI_DEPOSIT || '',
  referrals: process.env.EMOJI_REFERRALS || '',
  orders: process.env.EMOJI_ORDERS || '',
  support: process.env.EMOJI_SUPPORT || '',
  about: process.env.EMOJI_ABOUT || '',
  api: process.env.EMOJI_API || '',
  back: process.env.EMOJI_BACK || '',
};

// Load saved emojis from file if present
try {
  if (fs.existsSync(EMOJI_FILE)) {
    const raw = fs.readFileSync(EMOJI_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    emojiMap = { ...emojiMap, ...parsed };
  }
} catch (e) {
  console.warn('Failed to load .custom-emojis.json:', e);
}

function save() {
  try {
    fs.writeFileSync(EMOJI_FILE, JSON.stringify(emojiMap, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to save .custom-emojis.json:', e);
  }
}

export function getCustomEmoji(key: string): string | undefined {
  const norm = key.toLowerCase().trim();
  const val = emojiMap[norm];
  return val && val.trim() ? val.trim() : undefined;
}

export function setCustomEmoji(key: string, customEmojiId: string): void {
  const norm = key.toLowerCase().trim();
  emojiMap[norm] = customEmojiId.trim();
  save();
}

export function getAllCustomEmojis(): Record<string, string> {
  return { ...emojiMap };
}

/**
 * Returns <tg-emoji emoji-id="...">fallback</tg-emoji> if a custom emoji ID exists,
 * otherwise returns the fallback unicode emoji.
 */
export function tgEmoji(key: string, fallback: string): string {
  const id = getCustomEmoji(key);
  if (id) {
    return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
  }
  return fallback;
}

export type ButtonStyle = 'primary' | 'success' | 'danger';

export function makeCustomButton(
  key: string,
  text: string,
  callback_data: string,
  style?: ButtonStyle
): { text: string; callback_data: string; icon_custom_emoji_id?: string; style?: ButtonStyle } {
  const btn: any = { text, callback_data };
  const id = getCustomEmoji(key);
  if (id) {
    btn.icon_custom_emoji_id = id;
  }
  if (style) {
    btn.style = style;
  }
  return btn;
}
