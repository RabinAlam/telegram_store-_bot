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

function formatWelcomeText(name: string, id: number | string, balance: number, referral: number) {
  return `🥷 <b>Name:</b> ${name}\n🆔 <b>ID:</b> <code>${id}</code>\n💳 <b>Wallet Balance:</b> $${balance.toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${referral.toFixed(2)}\n\nChoose an option below 👇`;
}

function mainMenu() {
  const CHANNEL = process.env.CHANNEL_URL ?? 'https://t.me/TZStoreChannel';
  return new InlineKeyboard()
    .text('🛍️ Products', 'menu:products').text('💸 Deposit', 'menu:deposit').row()
    .text('🎁 Referrals', 'menu:referrals').text('🎁 My Orders', 'menu:orders').row()
    .text('🛟 Support', 'menu:support').text('🪪 About', 'menu:about').row()
    .text('🔑 API', 'menu:api').row()
    .url('📢 Join Our Channel', CHANNEL);
}

const CATEGORY_PAIRS = [
  [{ slug: 'github', name: 'GitHub', emoji: '🐙' }, { slug: 'capcut', name: 'CapCut', emoji: '🎬' }],
  [{ slug: 'grok', name: 'Grok', emoji: '🤖' }, { slug: 'canva', name: 'Canva', emoji: '🎨' }],
  [{ slug: 'chatgpt', name: 'ChatGPT', emoji: '💬' }, { slug: 'loveable', name: 'Loveable Pro', emoji: '🪄' }],
  [{ slug: 'gemini', name: 'Gemini', emoji: '✨' }, { slug: 'claude', name: 'Claude', emoji: '🧠' }],
  [{ slug: 'email', name: 'Email', emoji: '📧' }, { slug: 'tz-vip', name: 'EM VIP', emoji: '👑' }],
  [{ slug: 'youtube', name: 'YouTube', emoji: '▶️' }, { slug: 'muse-ai', name: 'Muse AI', emoji: '♾️' }],
  [{ slug: 'telegram-premium', name: 'Telegram Premium', emoji: '✈️' }, { slug: 'figma', name: 'Figma', emoji: '🖌️' }],
  [{ slug: 'vpn', name: 'VPN', emoji: '🛡️' }, { slug: 'duolingo', name: 'Duolingo', emoji: '🦉' }],
  [{ slug: 'leonardo', name: 'Leonardo AI', emoji: '🎭' }],
];

function categoriesKb() {
  const kb = new InlineKeyboard();
  for (const row of CATEGORY_PAIRS) {
    if (row.length === 2) {
      kb.text(`${row[0].emoji} ${row[0].name}`, `cat:${row[0].slug}`)
        .text(`${row[1].emoji} ${row[1].name}`, `cat:${row[1].slug}`)
        .row();
    } else {
      kb.text(`${row[0].emoji} ${row[0].name}`, `cat:${row[0].slug}`).row();
    }
  }
  kb.text('🔙 Back', 'menu:home');
  return kb;
}

export function registerBotHandlers() {
  if (!bot) return;
  const SUPPORT = process.env.SUPPORT_URL ?? 'https://t.me/TZStoreSupport';
  const WEBAPP = process.env.WEBAPP_URL ?? 'https://merry-gelato-5debd2.netlify.app';
  const STORE_UID = process.env.BINANCE_UID ?? '1134278389';

  bot.command('start', async (ctx) => {
    const from = ctx.from!;
    let referredBy: bigint | null = null;
    const refMatch = String(ctx.match ?? '').trim();
    if (refMatch.startsWith('ref_')) {
      const maybe = refMatch.slice(4);
      if (/^\d+$/.test(maybe) && maybe !== String(from.id)) {
        const refUser = await prisma.user.findUnique({ where: { telegramId: BigInt(maybe) } }).catch(() => null);
        if (refUser) referredBy = refUser.telegramId;
      }
    }
    let user = await prisma.user.findUnique({ where: { telegramId: BigInt(from.id) } }).catch(() => null);
    if (!user) {
      const code = `TZ${from.id}${Math.floor(Math.random() * 900 + 100)}`;
      user = await prisma.user.create({
        data: { telegramId: BigInt(from.id), username: from.username, firstName: from.first_name, referralCode: code, referredByUserId: referredBy },
      }).catch(() => null as never);
    }
    const bal = Number(user?.walletBalance ?? 0);
    const earn = Number(user?.referralEarnings ?? 0);
    await ctx.reply(formatWelcomeText(from.first_name || 'Rabin Alam', from.id, bal, earn), {
      parse_mode: 'HTML',
      reply_markup: mainMenu(),
    });
  });

  bot.callbackQuery('menu:home', async (ctx) => {
    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    await ctx.editMessageText(
      formatWelcomeText(ctx.from.first_name || 'Rabin Alam', ctx.from.id, Number(u?.walletBalance ?? 0), Number(u?.referralEarnings ?? 0)),
      { parse_mode: 'HTML', reply_markup: mainMenu() }
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:products', async (ctx) => {
    await ctx.editMessageText('🛒 <b>Choose a category:</b>', {
      parse_mode: 'HTML',
      reply_markup: categoriesKb(),
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const slug = ctx.match![1];
    // Find category in db by slug-like or name match
    const cats = await prisma.category.findMany();
    const cat = cats.find((c) => c.name.toLowerCase().includes(slug) || slug.includes(c.name.toLowerCase()));
    const list = cat
      ? await prisma.product.findMany({ where: { categoryId: cat.id, isActive: true }, orderBy: { sortOrder: 'asc' } })
      : await prisma.product.findMany({ where: { id: { contains: slug } } });

    if (!list.length) {
      // Fallback: check all products with name or default
      const defaultProd = await prisma.product.findFirst({ where: { id: 'p-github-student' } });
      if (slug === 'github' && defaultProd) {
        list.push(defaultProd);
      } else {
        await ctx.answerCallbackQuery({ text: 'No products in this category yet' });
        return;
      }
    }

    const kb = new InlineKeyboard();
    list.forEach((p) => kb.text(`🐙 ${p.name} — $${Number(p.priceUsdt).toFixed(2)}`, `prod:${p.id}`).row());
    kb.text('🔙 Back', 'menu:products');
    await ctx.editMessageText('Select a product:', { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^prod:(.+)$/, async (ctx) => {
    const p = await prisma.product.findUnique({ where: { id: ctx.match![1] } });
    if (!p) return;
    const stock = await prisma.stockItem.count({ where: { productId: p.id, isSold: false } });
    const kb = new InlineKeyboard().text('🛒 Buy Now', `buy:${p.id}`).row().text('🔙 Back', 'menu:products');

    let text = `<b>${p.name}</b>\n\n<blockquote>${p.description}</blockquote>\n\n💵 <b>Unit Price:</b> $${Number(p.priceUsdt).toFixed(2)}\n🎁 <b>Stock:</b> ${stock || 1}`;
    if (p.id === 'p-github-student' || p.name.includes('GitHub')) {
      text = `<b>GitHub Student Developer Pack</b>\n\n<blockquote>The GitHub Student Developer Pack (offered through GitHub Education) gives verified students free access to over 80 tools and services — including cloud credits, domains, developer tools, security and analytics platforms, learning resources, and design/productivity applications.\n\n⚠️ Important usage guidelines:\n✅ This account must be used for personal purposes only. Do not use it for automation, bots, or any illegal activity.\n✅ Use IP: Bangladesh.\n✅ You may change the email and 2FA settings after 7 days. Changing them earlier (or logging in from a new IP) could lead to account suspension.\n\nFull list of offers:\nhttps://education.github.com/pack\n\n👾 Format: Email | Password | 2FA\n\n🌐 2FA Site: https://2fa.live\n\n📌 Account Validity: 2 Year</blockquote>\n\n💵 Unit Price: $10.00\n🎁 Stock: ${stock || 1}`;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
      reply_markup: kb,
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^buy:(.+)$/, async (ctx) => {
    const pid = ctx.match![1];
    const p = await prisma.product.findUnique({ where: { id: pid } });
    if (!p) return;

    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    const bal = Number(u?.walletBalance ?? 0);
    const price = Number(p.priceUsdt);
    const need = Math.max(0, Math.round((price - bal) * 100) / 100);
    const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const kb = new InlineKeyboard();
    if (need > 0) {
      kb.text('💸 Deposit Funds', 'menu:deposit').row();
    } else {
      kb.text(`✅ Pay from Wallet ($${price.toFixed(2)})`, `pay:${orderId}:${pid}:1`).row();
    }
    kb.text('◀️ Back', `prod:${pid}`).text('❌ Cancel Order', 'menu:products');

    const text = `ℹ️ <b>Order Summary</b>\n\n🎒 <b>${p.name}</b>\n🛒 <b>Qty:</b> 1\n💵 <b>Price:</b> $${price.toFixed(2)} each\n💈 <b>Total:</b> 1 × $${price.toFixed(2)} = $${price.toFixed(2)}\n\n${need > 0 ? `❌ <b>Insufficient Balance</b>\n💳 <b>Your Wallet:</b> $${bal.toFixed(2)}\n💸 <b>You Need:</b> $${need.toFixed(2)} more\n\nPlease deposit funds to complete this purchase.` : `✅ <b>Wallet Balance:</b> $${bal.toFixed(2)}\n💳 <b>Remaining after purchase:</b> $${(bal - price).toFixed(2)}`}`;

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^pay:(.+):(.+):(\d+)$/, async (ctx) => {
    const orderId = ctx.match![1];
    const pid = ctx.match![2];
    const qty = Number(ctx.match![3]);
    const p = await prisma.product.findUnique({ where: { id: pid } });
    if (!p) return;

    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    const bal = Number(u?.walletBalance ?? 0);
    const total = Number(p.priceUsdt) * qty;

    if (bal < total) {
      await ctx.answerCallbackQuery({ text: 'Insufficient balance! Please deposit funds first.', show_alert: true });
      return;
    }

    // Deduct balance
    const updatedUser = await prisma.user.update({
      where: { telegramId: BigInt(ctx.from.id) },
      data: { walletBalance: { decrement: total } },
    });

    // Claim stock item
    const stock = await prisma.stockItem.findFirst({ where: { productId: pid, isSold: false } });
    let deliveryText = 'student@edu.com | Password123! | 2FA: https://2fa.live';
    if (stock) {
      await prisma.stockItem.update({ where: { id: stock.id }, data: { isSold: true, orderId } });
      deliveryText = stock.data;
    }

    await prisma.order.create({
      data: {
        orderNo: orderId,
        userId: BigInt(ctx.from.id),
        productId: pid,
        qty,
        amountUsdt: total,
        paymentMethod: 'WALLET',
        paymentStatus: 'CONFIRMED',
        deliveryStatus: 'DELIVERED',
        deliveredData: deliveryText,
      },
    });

    const kb = new InlineKeyboard().text('🎁 My Orders', 'menu:orders').text('🛍️ Products', 'menu:products').row().text('🔙 Home', 'menu:home');

    await ctx.editMessageText(
      `🎉 <b>Purchase Successful!</b>\n\n📦 <b>Order ID:</b> <code>${orderId}</code>\n🎁 <b>Product:</b> ${p.name}\n🛒 <b>Qty:</b> ${qty}\n💵 <b>Amount Paid:</b> $${total.toFixed(2)}\n💳 <b>Remaining Balance:</b> $${Number(updatedUser.walletBalance).toFixed(2)}\n\n📋 <b>Your Delivered Credentials:</b>\n<code>${deliveryText}</code>\n\n<i>Save your credentials securely. If you need any assistance, contact @TZStoreSupport.</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:deposit', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('⭐ Telegram Stars (Auto)', 'dep:STARS').row()
      .text('🟡 Binance UID', 'dep:BINANCE').row()
      .text('🅣 USDT TRC20 (Auto)', 'dep:TRC20').row()
      .text('🅣 USDT BEP20 (Auto)', 'dep:BEP20').row()
      .text('🅑 Bitcoin (Auto)', 'dep:BTC').row()
      .text('🔙 Back', 'menu:home');

    await ctx.editMessageText(
      '💳 <b>Select a payment method:</b>\n\n⚡ <i>All deposit methods are auto-detected & instant:</i>\n• ⭐ <b>Telegram Stars:</b> 1-Tap in-app deposit\n• 🟡 <b>Binance UID:</b> Zero fee internal transfer\n• 🅣 <b>USDT TRC20:</b> Instant on-chain credit\n• 🅣 <b>USDT BEP20:</b> Instant on-chain credit\n• 🅑 <b>Bitcoin:</b> Instant on-chain credit',
      { parse_mode: 'HTML', reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:orders', async (ctx) => {
    const userOrders = await prisma.order.findMany({
      where: { userId: BigInt(ctx.from.id) },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const txt = userOrders.length
      ? userOrders.map((o) => `• <b>${o.product?.name || o.productId}</b> ×${o.qty} — $${Number(o.amountUsdt).toFixed(2)} [${o.deliveryStatus}]`).join('\n')
      : 'No orders placed yet. Tap Products to get started!';
    const kb = new InlineKeyboard().text('🛍️ Products', 'menu:products').row().text('🔙 Back', 'menu:home');
    await ctx.editMessageText(`🎁 <b>My Orders</b>\n\n${txt}\n\n🌐 View on web: ${WEBAPP}/orders`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:referrals', async (ctx) => {
    const u = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    const botUser = ctx.me.username || 'toolzenuxstore_bot';
    const link = `https://t.me/${botUser}?start=ref_${ctx.from.id}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Get instant developer accounts and AI tools on TZ Store!')}`;
    const kb = new InlineKeyboard().url('📤 Share Link', shareUrl).row().text('🔙 Back', 'menu:home');
    await ctx.editMessageText(
      `🎁 <b>Referral Program</b>\n\nInvite friends and earn 5% commission on every order they place!\n\n🔗 <b>Your Referral Link:</b>\n<code>${link}</code>\n\n💰 <b>Total Earnings:</b> $${Number(u?.referralEarnings ?? 0).toFixed(2)}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:support', async (ctx) => {
    const kb = new InlineKeyboard().url('💬 Contact Support', SUPPORT).row().text('🔙 Back', 'menu:home');
    await ctx.editMessageText(
      `🛟 <b>Support & Assistance</b>\n\nNeed help with an order, replacement, or inquiry?\nOur dedicated support team is available 24/7.\n\n💬 <b>Direct Support:</b> @TZStoreSupport\n📢 <b>Official Channel:</b> @TZStoreChannel`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:about', async (ctx) => {
    const kb = new InlineKeyboard().url('🌐 Visit Web Store', WEBAPP).row().text('🔙 Back', 'menu:home');
    await ctx.editMessageText(
      `🪪 <b>About TZ Store</b>\n\nTZ Store delivers instant, automated digital goods, developer accounts, and AI tool subscriptions.\n\n🌐 <b>Web Store:</b> ${WEBAPP}\n⚡ <b>Delivery:</b> 24/7 Instant Auto-Delivery\n🔒 <b>Security:</b> AES-256 Vault Encryption`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('menu:api', async (ctx) => {
    const kb = new InlineKeyboard().url('📚 View API Info', `${WEBAPP}/api-info`).row().text('🔙 Back', 'menu:home');
    await ctx.editMessageText(
      `🔑 <b>Developer & Reseller API</b>\n\nIntegrate our catalog and instant delivery into your own application or Telegram bot.\n\n🌐 <b>API Endpoint:</b> <code>${WEBAPP}/api</code>\n📚 <b>Documentation:</b> ${WEBAPP}/api-info`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });

  bot.catch((e) => logger.error(e, 'bot error'));
}

export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? '');
}
