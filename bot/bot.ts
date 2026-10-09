// TZ Store classic bot — matches EM screenshots, rebranded.
// Run: npm run bot (polling). Requires BOT_TOKEN, WEBAPP_URL.
import { Bot, InlineKeyboard } from 'grammy';
import crypto from 'node:crypto';
import { CATEGORIES, PRODUCTS, unitPriceFor } from '../lib/seed-data';

const token = process.env.BOT_TOKEN!;
if (!token) throw new Error('BOT_TOKEN missing');
const bot = new Bot(token);
const WEBAPP = process.env.WEBAPP_URL ?? 'https://tz-store.example.com';
const CHANNEL = process.env.CHANNEL_URL ?? 'https://t.me/TZStoreChannel';
const SUPPORT = process.env.SUPPORT_URL ?? 'https://t.me/TZStoreSupport';
const STORE_UID = process.env.BINANCE_UID ?? '1134278389';
const SPOT_KEY = process.env.BINANCE_SPOT_API_KEY ?? '';
const SPOT_SECRET = process.env.BINANCE_SPOT_SECRET ?? '';
const ADMIN_CHAT = process.env.ADMIN_NOTIFY_CHAT_ID ?? '';

// Binance Spot check: does this TxID exist in OUR deposit history? (personal account, no merchant)
async function findDepositByTxid(txid: string): Promise<{ amount: number; coin: string; txId: string } | null> {
  if (!SPOT_KEY || !SPOT_SECRET) return null; // keys not configured -> manual review
  try {
    const qs = new URLSearchParams({ coin: 'USDT', limit: '100', timestamp: String(Date.now()), recvWindow: '10000' }).toString();
    const sig = crypto.createHmac('sha256', SPOT_SECRET).update(qs).digest('hex');
    const r = await fetch(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${qs}&signature=${sig}`, {
      headers: { 'X-MBX-APIKEY': SPOT_KEY },
    });
    if (!r.ok) return null;
    const list = (await r.json()) as Array<{ amount: string; coin: string; txId?: string; status?: number }>;
    const needle = txid.trim().toLowerCase();
    const hit = (Array.isArray(list) ? list : []).find(
      (d) => (d.status === undefined || d.status === 1) && d.txId && (d.txId.toLowerCase().includes(needle) || needle.includes(d.txId.toLowerCase())),
    );
    if (!hit) return null;
    return { amount: Number(hit.amount), coin: hit.coin, txId: hit.txId! };
  } catch {
    return null;
  }
}

async function notifyAdmin(text: string) {
  if (!ADMIN_CHAT) return;
  try { await bot.api.sendMessage(ADMIN_CHAT, text, { parse_mode: 'HTML' }); } catch { /* ignore */ }
}

type Wallet = { balance: number; referral: number };
const wallets = new Map<number, Wallet>();
const orders: any[] = [];
const deposits = new Map<string, { uid: number; provider: string; ref: string; expiresAt: number; status: string; txid?: string; credited?: number }>();
const awaitingTxid = new Map<number, string>(); // userId -> depositId waiting for TxID paste
const pendingQty = new Map<number, string>();

const w = (id: number): Wallet => {
  let v = wallets.get(id);
  if (!v) { v = { balance: 0, referral: 0 }; wallets.set(id, v); }
  return v;
};

function mainMenu() {
  return new InlineKeyboard()
    .text('🛍 Category Product', 'menu:products').text('💲 Deposit', 'menu:deposit').row()
    .text('🎁 Referrals', 'menu:referrals').text('🎁 My Orders', 'menu:orders').row()
    .text('🎧 Support', 'menu:support').text('🔎 About', 'menu:about').row()
    .text('🔑 API', 'menu:api').row()
    .text('📣 Join Our Channel', 'menu:channel');
}

function categoriesKb() {
  const kb = new InlineKeyboard();
  CATEGORIES.forEach((c, i) => {
    kb.text(`${c.emoji} ${c.name}`, `cat:${c.slug}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text('⬅️ Back', 'menu:home');
  return kb;
}

function productDetail(p: any) {
  return `🛒 <b>${p.title}</b>\n\n${p.desc}\n\n📦 Contents: ${p.contents}\n\n💵 Unit Price: <b>$${p.priceUsdt.toFixed(2)}</b>\n🎁 Stock: <b>${p.stock}</b>\n🖼 Real image: ${WEBAPP}${(CATEGORIES.find(c => c.slug === p.categorySlug) as any)?.logo ?? ''}\n🌐 View with image: ${WEBAPP}/p/${p.id}`;
}

bot.command('start', async (ctx) => {
  const u = ctx.from!;
  const bal = w(u.id);
  await ctx.reply(
    `🟢 <b>Name:</b> ${u.first_name}\n🆔 <b>ID:</b> <code>${u.id}</code>\n💳 <b>Wallet Balance:</b> $${bal.balance.toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${bal.referral.toFixed(2)}\n\nChoose an option below 👇`,
    { parse_mode: 'HTML', reply_markup: mainMenu() }
  );
});

bot.callbackQuery('menu:home', async (ctx) => {
  const u = ctx.from!; const bal = w(u.id);
  await ctx.editMessageText(
    `🟢 <b>Name:</b> ${u.first_name}\n🆔 <b>ID:</b> <code>${u.id}</code>\n💳 <b>Wallet Balance:</b> $${bal.balance.toFixed(2)}\n🎁 <b>Referral Earnings:</b> $${bal.referral.toFixed(2)}\n\nChoose an option below 👇`,
    { parse_mode: 'HTML', reply_markup: mainMenu() }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('menu:products', async (ctx) => {
  await ctx.editMessageText('🦋 <b>Choose a category:</b>', { parse_mode: 'HTML', reply_markup: categoriesKb() });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
  const slug = ctx.match![1];
  const list = PRODUCTS.filter((p) => p.categorySlug === slug);
  if (!list.length) {
    await ctx.answerCallbackQuery({ text: 'No products yet', show_alert: false });
    return;
  }
  const kb = new InlineKeyboard();
  list.forEach((p) => kb.text(`${p.title} — $${p.priceUsdt.toFixed(2)}`, `prod:${p.id}`).row());
  kb.text('⬅️ Back', 'menu:products');
  await ctx.editMessageText('Select a product:', { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^prod:(.+)$/, async (ctx) => {
  const p: any = PRODUCTS.find((x) => x.id === ctx.match![1]);
  if (!p) return;
  const kb = new InlineKeyboard().text('🛒 Buy Now', `buy:${p.id}`).row().text('⬅️ Back', 'menu:products');
  // Real image lives on website (SVG logos); Telegram photo uses webapp link preview.
  await ctx.editMessageText(productDetail(p), { parse_mode: 'HTML', reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^buy:(.+)$/, async (ctx) => {
  const pid = ctx.match![1];
  pendingQty.set(ctx.from!.id, pid);
  const kb = new InlineKeyboard()
    .text('1', `qty:${pid}:1`).text('2', `qty:${pid}:2`).text('3', `qty:${pid}:3`).text('5', `qty:${pid}:5`).row()
    .text('10', `qty:${pid}:10`).text('15', `qty:${pid}:15`).text('20', `qty:${pid}:20`).text('25', `qty:${pid}:25`).row()
    .text('✏️ Custom qty', `qtycustom:${pid}`).row()
    .text('◀️ Back to Product', `prod:${pid}`).text('❌ Cancel', 'menu:products');
  const p: any = PRODUCTS.find((x) => x.id === pid);
  await ctx.editMessageText(`Select Quantity\n\n🎁 ${p.title}\n💵 $${p.priceUsdt.toFixed(2)} / code\n\nHow many codes do you want?`, { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^qty:(.+):(\d+)$/, async (ctx) => {
  const pid = ctx.match![1]; const qty = Number(ctx.match![2]);
  const p: any = PRODUCTS.find((x) => x.id === pid);
  const unit = unitPriceFor(p, qty); const total = Math.round(unit * qty * 100) / 100;
  const bal = w(ctx.from!.id);
  const need = Math.max(0, Math.round((total - bal.balance) * 100) / 100);
  const oid = `o${Date.now()}`;
  orders.push({ id: oid, user: ctx.from!.id, productId: pid, qty, total, status: 'PENDING' });
  const kb = new InlineKeyboard();
  if (need > 0) kb.text('💲 Deposit Funds', 'menu:deposit').row();
  else kb.text('✅ Pay from Wallet', `pay:${oid}`).row();
  kb.text('◀️ Back', `buy:${pid}`).text('❌ Cancel Order', 'menu:products');
  await ctx.editMessageText(
    `ℹ️ <b>Order Summary</b>\n\n🎁 ${p.title}\n🛒 Qty: ${qty}\n💵 Price: $${unit.toFixed(2)} each\n🧾 Total: ${qty} × $${unit.toFixed(2)} = $${total.toFixed(2)}\n\n${need > 0 ? `❌ <b>Insufficient Balance</b>\n💳 Your Wallet: $${bal.balance.toFixed(2)}\n💸 You Need: $${need.toFixed(2)} more\n\nPlease deposit funds to complete this purchase.` : `✅ Wallet OK — pay now or deposit more.`}`,
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
    .text('⬅️ Back', 'menu:home');
  await ctx.editMessageText('💳 Select a payment method:\n\n⚡ All deposit methods are auto-detected & instant:\n• ⭐ Telegram Stars: 1-Tap in-app deposit\n• 🟡 Binance UID: Zero fee internal transfer\n• 🅣 USDT / ₿ Crypto: On-chain instant credit', { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^dep:(.+)$/, async (ctx) => {
  const provider = ctx.match![1];
  const ref = `#${Math.floor(9000 + Math.random() * 900)}`;
  const id = `in${Date.now()}`;
  deposits.set(id, { uid: ctx.from!.id, provider, ref, expiresAt: Date.now() + 20 * 60_000, status: 'Pending Payment' });
  const kb = new InlineKeyboard().text('📝 Submit TxID / Order ID', `submit:${id}`).row().text('🔄 Check Status', `status:${id}`).row().text('❌ Cancel', 'menu:deposit');
  if (provider === 'BINANCE') {
    await ctx.editMessageText(`⏳ Generating deposit...\n\n🟡 <b>Binance UID — Deposit ${ref}</b>\n\n📩 Send <b>ANY AMOUNT</b> to the address below.\n\n🧾 To UID:\n<code>${STORE_UID}</code>\n\n⏳ Expires in: <b>20 minutes</b>\n🔄 Status: <i>Pending Payment</i>\n\n⚠️ <b>IMPORTANT:</b> After sending the funds, paste your Binance Order ID / TxID here to get credited.`, { parse_mode: 'HTML', reply_markup: kb });
  } else {
    await ctx.editMessageText(`⏳ Generating deposit...\n\n<b>${provider} — Deposit ${ref}</b>\n\nPay to the address shown in Mini App:\n${WEBAPP}/pay/${id}\n\n⏳ Expires in: <b>20 minutes</b>\n🔄 Status: <i>Pending Payment</i>`, { parse_mode: 'HTML', reply_markup: kb });
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^submit:(.+)$/, async (ctx) => {
  const d = deposits.get(ctx.match![1]);
  if (!d || d.uid !== ctx.from!.id) { await ctx.answerCallbackQuery({ text: 'Deposit not found' }); return; }
  if (Date.now() > d.expiresAt) {
    d.status = 'Expired';
    await ctx.answerCallbackQuery({ text: 'Deposit expired — create a new one' });
    return;
  }
  awaitingTxid.set(ctx.from!.id, ctx.match![1]);
  await ctx.answerCallbackQuery();
  await ctx.reply(`📝 <b>Submit TxID / Order ID</b> — Deposit <b>${d.ref}</b>\n\nPaste your Binance Order ID / TxID here as your next message.\n\nTo UID was: <code>${STORE_UID}</code>`, { parse_mode: 'HTML' });
});

bot.callbackQuery(/^status:(.+)$/, async (ctx) => {
  const d = deposits.get(ctx.match![1]);
  if (!d || d.uid !== ctx.from!.id) { await ctx.answerCallbackQuery({ text: 'Deposit not found' }); return; }
  const left = Math.max(0, Math.ceil((d.expiresAt - Date.now()) / 60000));
  if (Date.now() > d.expiresAt && d.status === 'Pending Payment') d.status = 'Expired';
  const kb = new InlineKeyboard()
    .text('📝 Submit TxID / Order ID', `submit:${ctx.match![1]}`).row()
    .text('⬅️ Back', 'menu:deposit');
  await ctx.editMessageText(
    `🔄 <b>Deposit ${d.ref}</b>\n\n🔄 Status: <i>${d.status}</i>\n${d.txid ? `🧾 TxID: <code>${d.txid}</code>\n` : ''}${d.credited ? `💰 Credited: <b>$${d.credited.toFixed(2)}</b>\n` : ''}⏳ Expires in: <b>${left} minutes</b>\n\n${d.status.startsWith('Credited') ? '🎉 Funds are in your wallet — go to Category Product to order!' : d.status === 'Under Review' ? '✅ Received! Admin will verify and credit your wallet shortly.' : 'Send funds to UID <code>' + STORE_UID + '</code>, then submit your TxID.'}`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('menu:orders', async (ctx) => {
  const mine = orders.filter((o) => o.user === ctx.from!.id).slice(-5).reverse();
  const txt = mine.length ? mine.map((o) => `• ${o.productId} ×${o.qty} $${o.total} [${o.status}]`).join('\n') : 'No orders yet.';
  await ctx.editMessageText(`🎁 <b>My Orders</b>\n\n${txt}\n\nFull history: ${WEBAPP}/orders`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:home') });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery('menu:referrals', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`🎁 <b>Referrals</b>\n\nYour link: https://t.me/${ctx.me.username}?start=ref_${ctx.from!.id}\n\nEarn commission on every referred purchase.`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:home') });
});
bot.callbackQuery('menu:support', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`🎧 <b>Support:</b> ${SUPPORT}`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:home') });
});
bot.callbackQuery('menu:about', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`🔎 <b>TZ Store</b>\n\nInstant digital goods — same flow as website ${WEBAPP}.`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:home') });
});
bot.callbackQuery('menu:api', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`🔑 <b>API</b>\n\nReseller API docs: ${WEBAPP}/api`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:home') });
});
bot.callbackQuery('menu:channel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`📣 <b>Join Our Channel:</b> ${CHANNEL}`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:home') });
});

bot.on('message:text', async (ctx) => {
  const txt = ctx.message.text.trim();
  // User pasted TxID after tapping Submit
  const depId = awaitingTxid.get(ctx.from!.id);
  if (depId) {
    const d = deposits.get(depId);
    if (d && d.uid === ctx.from!.id && Date.now() <= d.expiresAt && /^[a-z0-9]{6,}$/i.test(txt)) {
      d.txid = txt;
      awaitingTxid.delete(ctx.from!.id);
      await ctx.reply('🔍 <b>Checking transaction…</b> hold on.', { parse_mode: 'HTML' });
      // Real Binance check (personal Spot account). No keys -> manual review.
      const hit = await findDepositByTxid(txt);
      const kb = new InlineKeyboard().text('🔄 Check Status', `status:${depId}`).row().text('⬅️ Back', 'menu:deposit');
      if (hit) {
        const bal = w(ctx.from!.id);
        bal.balance = Math.round((bal.balance + hit.amount) * 100) / 100;
        d.status = 'Credited ✅';
        d.credited = hit.amount;
        orders.push({ id: `dep${Date.now()}`, user: ctx.from!.id, productId: '💲 Wallet Deposit', qty: 1, total: hit.amount, status: 'CREDITED' });
        await ctx.reply(
          `✅ <b>Verified on Binance!</b>\n\n💰 <b>$${hit.amount.toFixed(2)} ${hit.coin}</b> credited to your wallet.\n🧾 TxID: <code>${hit.txId}</code>\n💳 New balance: <b>$${bal.balance.toFixed(2)}</b>`,
          { parse_mode: 'HTML', reply_markup: kb },
        );
      } else {
        d.status = 'Under Review';
        await notifyAdmin(
          `🔔 <b>Deposit needs review</b>\n👤 <code>${ctx.from!.id}</code> ${ctx.from.first_name}\n🧾 Deposit <b>${d.ref}</b> (${d.provider})\n🔗 TxID: <code>${txt}</code>\nCheck Binance UID <code>${STORE_UID}</code> history, then credit manually.`,
        );
        await ctx.reply(
          `📝 <b>TxID received!</b>\n\n🧾 <code>${txt}</code>\n🔄 Status: <i>Under Review</i>\n\n${SPOT_KEY ? 'Not found in recent deposits yet — if you just sent it, tap Check Status in a minute.' : 'Admin will verify against UID <code>' + STORE_UID + '</code> and credit your wallet.'} Tap Check Status for updates.`,
          { parse_mode: 'HTML', reply_markup: kb },
        );
      }
      return;
    }
    awaitingTxid.delete(ctx.from!.id);
  }
  // TxID submit shortcut
  if (/^[a-z0-9]{6,}$/i.test(txt)) {
    await ctx.reply('✅ TxID received — checking... Use Check Status in 1-2 min. Admin reviews underpayments.');
  }
});

bot.catch((e) => console.error('bot error', e));
bot.start();
console.log('TZ Store bot running (polling)');
