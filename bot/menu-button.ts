import fs from 'node:fs';
import path from 'node:path';
import { Bot, InlineKeyboard } from 'grammy';

if (!process.env.BOT_TOKEN) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || '').trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {}
}

const bot = new Bot(process.env.BOT_TOKEN || 'test-token');
const URL = process.env.WEBAPP_URL || 'https://merry-gelato-5debd2.netlify.app';

async function initMenuButton() {
  if (!process.env.BOT_TOKEN) {
    console.error('BOT_TOKEN is not defined');
    return;
  }
  await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Open Store', web_app: { url: URL } } });
  console.log(`Menu button set to: ${URL}`);
}

if (require.main === module || !module.parent) {
  initMenuButton().catch(console.error);
}
export async function restockBroadcast(chatId: string | number, productId: string, title: string, qty: number, price: string) {
  await bot.api.sendMessage(chatId, `🎁 Restocked!\n${title}\n✅ Available: ${qty}\n💎 Price: ${price}`, {
    reply_markup: new InlineKeyboard().webApp('Buy Now', `${URL}/p/${productId}?startapp=restock_${productId}`),
  });
}
// Deep links: ${URL}?startapp=product_<id> | restock_<id> | order_<id>
