import { store } from './store';

// Single shared fulfill path for Stars / crypto / Binance webhooks + manual admin fulfill.
// Idempotent: only PENDING/CONFIRMED/NEEDS_REVIEW orders are processed; DELIVERED returns as-is.
// Takes one vault row per qty unit. Empty vault -> NEEDS_REVIEW (manual delivery).
export async function fulfillOrder(orderId: string): Promise<{ status: string; deliveries?: Array<{ login: string; password: string }> }> {
  let order = store.getOrder(orderId);
  if (!order) {
    const { sharedOrder } = await import('./admin-api');
    const dbOrder = await sharedOrder(orderId);
    if (dbOrder) {
      order = {
        id: dbOrder.id,
        userTg: dbOrder.userTg,
        productId: dbOrder.productId,
        qty: dbOrder.qty,
        unitPrice: dbOrder.unitPrice,
        total: dbOrder.total,
        status: dbOrder.status,
        createdAt: dbOrder.createdAt,
        code: dbOrder.code,
        deliveries: dbOrder.deliveries,
      };
      try { store.createOrder(order); } catch {}
    }
  }
  if (!order) throw new Error('unknown order');
  if (order.status === 'DELIVERED') return { status: 'DELIVERED', deliveries: order.deliveries ?? [] };
  if (order.status !== 'PENDING' && order.status !== 'CONFIRMED' && order.status !== 'NEEDS_REVIEW') {
    return { status: order.status };
  }
  const hasVault = store.vaultHas(order.productId);
  let taken = hasVault ? store.vaultTake(order.productId, order.qty, order.id) : null;

  // If local store vault didn't have enough items, check Prisma stockItem table
  if (!taken && !process.env.VITEST) {
    try {
      const { db } = await import('./db');
      const prisma = db();
      if (prisma) {
        const dbOrder = await prisma.order.findUnique({ where: { orderNo: order.id } });
        if (dbOrder) {
          const pStocks = await prisma.stockItem.findMany({
            where: { productId: order.productId, isSold: false },
            take: order.qty,
            orderBy: { createdAt: 'asc' },
          });
          if (pStocks && pStocks.length >= order.qty) {
            const stockIds = pStocks.map((s) => s.id);
            await prisma.stockItem.updateMany({
              where: { id: { in: stockIds } },
              data: { isSold: true, orderId: dbOrder.id },
            });
            taken = pStocks.map((s) => {
              const parts = s.data.split(':');
              return { login: parts[0] || 'account', password: parts[1] || s.data };
            });
          }
        }
      }
    } catch (e) {
      console.warn('Prisma stockItem fulfillment error:', e);
    }
  }

  if (hasVault || taken) {
    if (!taken) {
      store.setOrderStatus(order.id, 'NEEDS_REVIEW');
      try {
        const { db } = await import('./db');
        const prisma = db();
        if (prisma) await prisma.order.update({ where: { orderNo: order.id }, data: { paymentStatus: 'PAID', deliveryStatus: 'FAILED' } }).catch(() => null);
      } catch {}
      return { status: 'NEEDS_REVIEW' };
    }
    store.setOrderDeliveries(order.id, taken);
    store.setOrderStatus(order.id, 'DELIVERED');
    const it = store.allIntents().find((i) => i.orderId === order.id && (i.status === 'PENDING' || i.status === 'CONFIRMED'));
    if (it) store.setIntent(it.id, { status: 'FULFILLED' });
    if (!process.env.VITEST) {
      void (async () => {
        try {
          const { db } = await import('./db');
          const prisma = db();
          if (prisma) await prisma.order.update({ where: { orderNo: order.id }, data: { paymentStatus: 'PAID', deliveryStatus: 'DELIVERED', deliveredData: JSON.stringify(taken) } }).catch(() => null);
        } catch {}
        sendTelegramDelivery(order.userTg, order, taken).catch(() => null);
      })();
    }
    return { status: 'DELIVERED', deliveries: taken };
  }
  // Legacy path: products without vault rows keep the placeholder-code behavior.
  const code = `EM-${order.id.slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  store.setOrderStatus(order.id, 'DELIVERED', code);
  const it = store.allIntents().find((i) => i.orderId === order.id && (i.status === 'PENDING' || i.status === 'CONFIRMED'));
  if (it) store.setIntent(it.id, { status: 'FULFILLED' });
  if (!process.env.VITEST) {
    void (async () => {
      try {
        const { db } = await import('./db');
        const prisma = db();
        if (prisma) await prisma.order.update({ where: { orderNo: order.id }, data: { paymentStatus: 'PAID', deliveryStatus: 'DELIVERED', deliveredData: code } }).catch(() => null);
      } catch {}
      sendTelegramDelivery(order.userTg, order, [], code).catch(() => null);
    })();
  }
  return { status: 'DELIVERED' };
}

async function sendTelegramDelivery(userTg: string, order: any, deliveries: Array<{ login: string; password: string }>, code?: string) {
  if (process.env.VITEST) return;
  const token = process.env.BOT_TOKEN || '8508569294:AAFan-h5MxrrKGnJGCHGYZX4pRUPDw9Z7CU';
  if (!token) return;

  let chatId: string | null = null;
  const tgClean = String(userTg ?? '').trim();
  if (/^\d+$/.test(tgClean)) {
    chatId = tgClean;
  } else {
    try {
      const { db } = await import('./db');
      const prisma = db();
      if (prisma) {
        const dbOrder = await prisma.order.findUnique({
          where: { orderNo: order.id },
          select: { userId: true },
        });
        if (dbOrder?.userId) chatId = String(dbOrder.userId);
      }
    } catch {}
  }

  if (!chatId) return;

  const credLines = (deliveries && deliveries.length > 0)
    ? deliveries.map((d, i) =>
        `<b>🔑 Account ${deliveries.length > 1 ? `#${i + 1}` : ''}</b>\n` +
        `👤 <b>ID / Email:</b> <code>${d.login}</code>\n` +
        `🔐 <b>Password:</b> <code>${d.password}</code>`
      ).join('\n\n')
    : `<b>🔑 Activation Key / Code:</b>\n<code>${code ?? order.code ?? ''}</code>`;

  const webAppUrl = process.env.WEBAPP_URL || 'https://merry-gelato-5debd2.netlify.app';
  const text =
    `🎉 <b>Order Delivered Successfully!</b>\n\n` +
    `📦 <b>Order ID:</b> <code>${order.id}</code>\n` +
    `🎁 <b>Product:</b> <b>${order.productId}</b>\n` +
    `🛒 <b>Quantity:</b> ${order.qty}\n` +
    `💵 <b>Total Paid:</b> $${Number(order.total).toFixed(2)}\n\n` +
    `📋 <b>Your Delivered Credentials:</b>\n\n` +
    `${credLines}\n\n` +
    `💡 <i>Tip: Tap on any ID or Password above to copy it instantly.</i>\n\n` +
    `💬 Need help? Contact @TZStoreSupport`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛍️ Open Mini App Store', web_app: { url: webAppUrl } },
            ],
            [
              { text: '💬 Contact Support', url: 'https://t.me/TZStoreSupport' },
            ],
          ],
        },
      }),
    });
  } catch (e) {
    console.error('Failed to send telegram delivery:', e);
  }
}
