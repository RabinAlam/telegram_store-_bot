"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
exports.sendUserMessage = sendUserMessage;
exports.notifyAdmins = notifyAdmins;
exports.registerBotHandlers = registerBotHandlers;
exports.renderTemplate = renderTemplate;
const grammy_1 = require("grammy");
const db_js_1 = require("./db.js");
const logger_js_1 = require("./logger.js");
const token = process.env.BOT_TOKEN ?? '';
exports.bot = token ? new grammy_1.Bot(token) : null;
async function sendUserMessage(telegramId, text) {
    if (!exports.bot) {
        logger_js_1.logger.warn('bot not configured, skip send');
        return;
    }
    try {
        await exports.bot.api.sendMessage(String(telegramId), text, { parse_mode: 'HTML' });
    }
    catch (e) {
        logger_js_1.logger.error({ e }, 'sendMessage failed');
    }
}
async function notifyAdmins(text) {
    const chatId = process.env.ADMIN_NOTIFY_CHAT_ID;
    if (!exports.bot || !chatId)
        return;
    try {
        await exports.bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
    }
    catch (e) {
        logger_js_1.logger.error({ e }, 'admin notify failed');
    }
}
function mainMenu() {
    return new grammy_1.InlineKeyboard()
        .text('🛍 Products', 'menu:products').text('💲 Deposit', 'menu:deposit').row()
        .text('🎁 Referrals', 'menu:referrals').text('🎁 My Orders', 'menu:orders').row()
        .text('🎧 Support', 'menu:support').text('🔎 About', 'menu:about').row()
        .text('🔑 API', 'menu:api').row()
        .text('📣 Join Our Channel', 'menu:channel');
}
function registerBotHandlers() {
    if (!exports.bot)
        return;
    const SUPPORT = process.env.SUPPORT_URL ?? 'https://t.me/TZStoreSupport';
    const CHANNEL = process.env.CHANNEL_URL ?? 'https://t.me/TZStoreChannel';
    const WEBAPP = process.env.WEBAPP_URL ?? 'http://localhost:3000';
    exports.bot.command('start', async (ctx) => {
        const from = ctx.from;
        const refMatch = (ctx.match) ?? '';
        if (refMatch.startsWith('ref_')) {
            const maybe = refMatch.slice(4);
            if (/^\d+$/.test(maybe)) {
                const refUser = await db_js_1.prisma.user.findUnique({ where: { telegramId: BigInt(maybe) } }).catch(() => null);
                void refUser;
            }
        }
        let user = await db_js_1.prisma.user.findUnique({ where: { telegramId: BigInt(from.id) } }).catch(() => null);
        if (!user) {
            const code = `TZ${from.id}${Math.floor(Math.random() * 900 + 100)}`;
            user = await db_js_1.prisma.user.create({
                data: { telegramId: BigInt(from.id), username: from.username, firstName: from.first_name, referralCode: code },
            }).catch(() => null);
        }
        const bal = Number(user?.walletBalance ?? 0);
        const earn = Number(user?.referralEarnings ?? 0);
        await ctx.reply(`🟢 <b>Name:</b> ${from.first_name}\n🆔 <b>ID:</b> <code>${from.id}</code>\n💳 <b>Wallet Balance:</b> $${bal.toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${earn.toFixed(2)}\n\nChoose an option below 👇`, { parse_mode: 'HTML', reply_markup: mainMenu() });
    });
    exports.bot.callbackQuery('menu:home', async (ctx) => {
        const u = await db_js_1.prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
        await ctx.editMessageText(`🟢 <b>Name:</b> ${ctx.from.first_name}\n🆔 <b>ID:</b> <code>${ctx.from.id}</code>\n💳 <b>Wallet Balance:</b> $${Number(u?.walletBalance ?? 0).toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${Number(u?.referralEarnings ?? 0).toFixed(2)}\n\nChoose an option below 👇`, { parse_mode: 'HTML', reply_markup: mainMenu() });
        await ctx.answerCallbackQuery();
    });
    exports.bot.callbackQuery('menu:products', async (ctx) => {
        const cats = await db_js_1.prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
        const kb = new grammy_1.InlineKeyboard();
        cats.forEach((c, i) => { kb.text(`${c.emoji} ${c.name}`, `cat:${c.id}`); if (i % 2 === 1)
            kb.row(); });
        kb.row().text('⬅️ Back', 'menu:home');
        await ctx.editMessageText('🦋 <b>Choose a category:</b>', { parse_mode: 'HTML', reply_markup: kb });
        await ctx.answerCallbackQuery();
    });
    exports.bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
        const list = await db_js_1.prisma.product.findMany({ where: { categoryId: ctx.match[1], isActive: true }, orderBy: { sortOrder: 'asc' } });
        if (!list.length) {
            await ctx.answerCallbackQuery({ text: 'No products yet' });
            return;
        }
        const kb = new grammy_1.InlineKeyboard();
        list.forEach((p) => kb.text(`${p.name} — $${Number(p.priceUsdt).toFixed(2)}`, `prod:${p.id}`).row());
        kb.text('⬅️ Back', 'menu:products');
        await ctx.editMessageText('Select a product:', { reply_markup: kb });
        await ctx.answerCallbackQuery();
    });
    exports.bot.callbackQuery(/^prod:(.+)$/, async (ctx) => {
        const p = await db_js_1.prisma.product.findUnique({ where: { id: ctx.match[1] } });
        if (!p)
            return;
        const stock = await db_js_1.prisma.stockItem.count({ where: { productId: p.id, isSold: false } });
        const kb = new grammy_1.InlineKeyboard().text('🛒 Buy Now', `buy:${p.id}`).row().text('⬅️ Back', 'menu:products');
        await ctx.editMessageText(`🛒 <b>${p.name}</b>\n\n${p.description}\n\n💵 <b>$${Number(p.priceUsdt).toFixed(2)}</b>  📦 Stock: <b>${p.deliveryMode === 'AUTO' ? stock : '∞'}</b>\n🌐 ${WEBAPP}/p/${p.id}`, { parse_mode: 'HTML', reply_markup: kb });
        await ctx.answerCallbackQuery();
    });
    for (const id of ['menu:deposit', 'menu:orders', 'menu:referrals', 'menu:support', 'menu:about', 'menu:api', 'menu:channel']) {
        exports.bot.callbackQuery(id, async (ctx) => {
            await ctx.answerCallbackQuery();
            const back = new grammy_1.InlineKeyboard().text('⬅️ Back', 'menu:home');
            if (id === 'menu:deposit')
                await ctx.editMessageText('💲 <b>Deposit:</b> open Mini App or send USDT, then submit TXID. Binance Pay auto-confirmed via webhook.', { parse_mode: 'HTML', reply_markup: back });
            else if (id === 'menu:orders') {
                const orders = await db_js_1.prisma.order.findMany({ where: { userId: BigInt(ctx.from.id) }, take: 5, orderBy: { createdAt: 'desc' } });
                await ctx.editMessageText(`🎁 <b>My Orders</b>\n\n${orders.map((o) => `• <code>${o.orderNo}</code> $${Number(o.amountUsdt)} [${o.paymentStatus}/${o.deliveryStatus}]`).join('\n') || 'No orders yet.'}`, { parse_mode: 'HTML', reply_markup: back });
            }
            else if (id === 'menu:referrals') {
                const u = await db_js_1.prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
                await ctx.editMessageText(`🎁 <b>Referrals</b>\n\nYour link: https://t.me/${ctx.me.username}?start=ref_${ctx.from.id}\nEarned: $${Number(u?.referralEarnings ?? 0).toFixed(2)}`, { parse_mode: 'HTML', reply_markup: back });
            }
            else if (id === 'menu:support')
                await ctx.editMessageText(`🎧 <b>Support:</b> ${SUPPORT}`, { parse_mode: 'HTML', reply_markup: back });
            else if (id === 'menu:about')
                await ctx.editMessageText('🔎 <b>TZ Store</b> — instant digital goods.', { parse_mode: 'HTML', reply_markup: back });
            else if (id === 'menu:api')
                await ctx.editMessageText(`🔑 <b>API:</b> ${WEBAPP}/api`, { parse_mode: 'HTML', reply_markup: back });
            else
                await ctx.editMessageText(`📣 <b>Channel:</b> ${CHANNEL}`, { parse_mode: 'HTML', reply_markup: back });
        });
    }
    exports.bot.catch((e) => logger_js_1.logger.error(e, 'bot error'));
}
// Render delivery template vars {{key}} {{username}} {{orderNo}}
function renderTemplate(tpl, vars) {
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}
