// Broadcast sender: processes a broadcast to users in batches.
// Used inline when Redis/BullMQ is unavailable, and by the queue worker otherwise.
import { prisma } from './db.js';
import { bot } from './bot.js';
import { logger } from './logger.js';

async function targets(segment: string): Promise<bigint[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  if (segment === 'active7d') {
    const rows = await prisma.user.findMany({ where: { createdAt: { gte: sevenDaysAgo }, status: 'ACTIVE' }, select: { telegramId: true } });
    return rows.map((r) => r.telegramId);
  }
  if (segment === 'buyers') {
    const rows = await prisma.order.findMany({ where: { paymentStatus: 'PAID' }, select: { userId: true }, distinct: ['userId'] });
    return rows.map((r) => r.userId);
  }
  if (segment === 'neverBought') {
    const buyers = await prisma.order.findMany({ where: { paymentStatus: 'PAID' }, select: { userId: true }, distinct: ['userId'] });
    const set = new Set(buyers.map((b) => String(b.userId)));
    const rows = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { telegramId: true } });
    return rows.map((r) => r.telegramId).filter((id) => !set.has(String(id)));
  }
  const rows = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { telegramId: true } });
  return rows.map((r) => r.telegramId);
}

export async function processBroadcast(broadcastId: string, segment = 'all') {
  const b = await prisma.broadcast.findUnique({ where: { id: broadcastId } });
  if (!b) return;
  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'SENDING', sentCount: 0 } });
  const ids = await targets(segment).catch(() => [] as bigint[]);
  let sent = 0;
  for (const id of ids) {
    try {
      if (bot) await bot.api.sendMessage(String(id), `<b>${b.title}</b>\n\n${b.text}`, { parse_mode: 'HTML' });
      sent += 1;
    } catch (e) {
      logger.warn({ e, id: String(id) }, 'broadcast send failed');
    }
    if (sent % 10 === 0) await prisma.broadcast.update({ where: { id: broadcastId }, data: { sentCount: sent } }).catch(() => null);
    await new Promise((r) => setTimeout(r, 40)); // ~25 msg/s, respect Telegram limits
  }
  await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'DONE', sentCount: sent } }).catch(() => null);
  logger.info({ broadcastId, sent }, 'broadcast done');
}
