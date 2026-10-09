// Bot-side: menu button + restock broadcast with Buy Now -> Mini App start_param.
// grammY variant (aiogram equivalent: set_chat_menu_button + inline web_app button).
import { Bot, InlineKeyboard } from 'grammy';
const bot = new Bot(process.env.BOT_TOKEN!);
const URL = process.env.WEBAPP_URL!;
await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Open Store', web_app: { url: URL } } });
export async function restockBroadcast(chatId: string | number, productId: string, title: string, qty: number, price: string) {
  await bot.api.sendMessage(chatId, `🎁 Restocked!\n${title}\n✅ Available: ${qty}\n💎 Price: ${price}`, {
    reply_markup: new InlineKeyboard().webApp('Buy Now', `${URL}/p/${productId}?startapp=restock_${productId}`),
  });
}
// Deep links: ${URL}?startapp=product_<id> | restock_<id> | order_<id>
