import { Bot, InlineKeyboard } from 'grammy';
import { prisma } from './db.js';
import { logger } from './logger.js';

const token = process.env.BOT_TOKEN ?? '';
export const bot = token ? new Bot(token) : null;

export async function sendUserMessage(telegramId: bigint | number | string, text: string) {
  if (!bot) { logger.warn('bot not configured, skip send'); return; }
  try { await bot.api.sendMessage(String(telegramId), text, { parse_mode: 'HTML' }); }
  catch (e) { logger.error({ e }, 'sendMessage failed'); }
}

export async function notifyAdmins(text: string) {
  const chatId = process.env.ADMIN_NOTIFY_CHAT_ID;
  if (!bot || !chatId) return;
  try { await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' }); }
  catch (e) { logger.error({ e }, 'admin notify failed'); }
}

function mainMenu() {
  return new InlineKeyboard()
    .text('🛍 Category Product', 'menu:products').text('💲 Deposit', 'menu:deposit').row()
    .text('🎁 Referrals', 'menu:referrals').text('🎁 My Orders', 'menu:orders').row()
    .text('🎧 Support', 'menu:support').text('🔎 About', 'menu:about').row()
    .text('🔑 API', 'menu:api').row()
    .text('📣 Join Our Channel', 'menu:channel');
}

export function registerBotHandlers() {
  if (!bot) return;
  const SUPPORT = process.env.SUPPORT_URL ?? 'https://t.me/TZStoreSupport';
  const CHANNEL = process.env.CHANNEL_URL ?? 'https://t.me/TZStoreChannel';
  const WEBAPP = process.env.WEBAPP_URL ?? 'http://localhost:3000';
  const STORE_UID = process.env.BINANCE_UID ?? '1134278389';

  bot.command('start', async (ctx) => {
    const from = ctx.from!;
    const refMatch = ((ctx as unknown as { match?: string }).match) ?? '';
    if (refMatch.startsWith('ref_')) {
      const maybe = refMatch.slice(4);
      if (/^\d+$/.test(maybe)) {
        const refUser = await prisma.user.findUnique({ where: { telegramId: BigInt(maybe) } }).catch(() => null);
        void refUser;
      }
    }
    let user = await prisma.user.findUnique({ where: { telegramId: BigInt(from.id) } }).catch(() => null);
    if (!user) {
      const code = `TZ${from.id}${Math.floor(Math.random() * 900 + 100)}`;
      user = await prisma.user.create({
        data: { telegramId: BigInt(from.id), username: from.username, firstName: from.first_name, referralCode: code },
      }).catch(() => null as never);
    }
    const bal = Number(user?.walletBalance ?? 0);
    const earn = Number(user?.referralEarnings ?? 0);
    await ctx.reply(
      `🟢 <b>Name:</b> ${from.first_name}\n🆔 <b>ID:</b> <code>${from.id}</code>\n💳 <b>Wallet Balance:</b> $${bal.toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${earn.toFixed(2)}\n\nChoose an option below 👇`,
      { parse_mode: 'HTML', reply_markup: mainMenu() },
    );
  });

  bot.callbackQuery('menu:home', async (ctx) => {
    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    await ctx.editMessageText(
      `🟢 <b>Name:</b> ${ctx.from.first_name}\n🆔 <b>ID:</b> <code>${ctx.from.id}</code>\n💳 <b>Wallet Balance:</b> $${Number(u?.walletBalance ?? 0).toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${Number(u?.referralEarnings ?? 0).toFixed(2)}\n\nChoose an option below 👇`,
      { parse_mode: 'HTML', reply_markup: mainMenu() },
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:products', async (ctx) => {
    const cats = await prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    const kb = new InlineKeyboard();
    cats.forEach((c: { emoji: string; name: string; id: string }, i: number) => { kb.text(`${c.emoji} ${c.name}`, `cat:${c.id}`); if (i % 2 === 1) kb.row(); });
    kb.row().text('⬅️ Back', 'menu:home');
    await ctx.editMessageText('🦋 <b>Choose a category:</b>', { parse_mode: 'HTML', reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const list = await prisma.product.findMany({ where: { categoryId: ctx.match![1], isActive: true }, orderBy: { sortOrder: 'asc' } });
    if (!list.length) { await ctx.answerCallbackQuery({ text: 'No products yet' }); return; }
    const kb = new InlineKeyboard();
    list.forEach((p: { name: string; priceUsdt: unknown; id: string }) => kb.text(`${p.name} — $${Number(p.priceUsdt).toFixed(2)}`, `prod:${p.id}`).row());
    kb.text('⬅️ Back', 'menu:products');
    await ctx.editMessageText('Select a product:', { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^prod:(.+)$/, async (ctx) => {
    const p = await prisma.product.findUnique({ where: { id: ctx.match![1] } });
    if (!p) return;
    const stock = await prisma.stockItem.count({ where: { productId: p.id, isSold: false } });
    const kb = new InlineKeyboard().text('🛒 Buy Now', `buy:${p.id}`).row().text('⬅️ Back', 'menu:products');
    await ctx.editMessageText(
      `🛒 <b>${p.name}</b>\n\n${p.description}\n\n💵 <b>$${Number(p.priceUsdt).toFixed(2)}</b>  📦 Stock: <b>${p.deliveryMode === 'AUTO' ? stock : '∞'}</b>\n🌐 ${WEBAPP}/p/${p.id}`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
    await ctx.answerCallbackQuery();
  });

  for (const id of ['menu:deposit', 'menu:orders', 'menu:referrals', 'menu:support', 'menu:about', 'menu:api', 'menu:channel'] as const) {
    bot.callbackQuery(id, async (ctx) => {
      await ctx.answerCallbackQuery();
      const back = new InlineKeyboard().text('⬅️ Back', 'menu:home');
      if (id === 'menu:deposit') await ctx.editMessageText(`💲 <b>Deposit:</b> send USDT to Binance UID <code>${STORE_UID}</code>, then submit your Order ID / TxID here or in the Mini App. Binance Pay auto-confirmed via webhook where configured.`, { parse_mode: 'HTML', reply_markup: back });
      else if (id === 'menu:orders') {
        const orders = await prisma.order.findMany({ where: { userId: BigInt(ctx.from.id) }, take: 5, orderBy: { createdAt: 'desc' } });
        await ctx.editMessageText(`🎁 <b>My Orders</b>\n\n${orders.map((o) => `• <code>${o.orderNo}</code> $${Number(o.amountUsdt)} [${o.paymentStatus}/${o.deliveryStatus}]`).join('\n') || 'No orders yet.'}`, { parse_mode: 'HTML', reply_markup: back });
      } else if (id === 'menu:referrals') {
        const u = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
        await ctx.editMessageText(`🎁 <b>Referrals</b>\n\nYour link: https://t.me/${ctx.me.username}?start=ref_${ctx.from.id}\nEarned: $${Number(u?.referralEarnings ?? 0).toFixed(2)}`, { parse_mode: 'HTML', reply_markup: back });
      } else if (id === 'menu:support') await ctx.editMessageText(`🎧 <b>Support:</b> ${SUPPORT}`, { parse_mode: 'HTML', reply_markup: back });
      else if (id === 'menu:about') await ctx.editMessageText('🔎 <b>TZ Store</b> — instant digital goods.', { parse_mode: 'HTML', reply_markup: back });
      else if (id === 'menu:api') await ctx.editMessageText(`🔑 <b>API:</b> ${WEBAPP}/api`, { parse_mode: 'HTML', reply_markup: back });
      else await ctx.editMessageText(`📣 <b>Channel:</b> ${CHANNEL}`, { parse_mode: 'HTML', reply_markup: back });
    });
  }

  bot.catch((e) => logger.error(e, 'bot error'));
}

// Render delivery template vars {{key}} {{username}} {{orderNo}}
export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? '');
}
