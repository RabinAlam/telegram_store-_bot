"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBroadcast = processBroadcast;
// Broadcast sender: processes a broadcast to users in batches.
// Used inline when Redis/BullMQ is unavailable, and by the queue worker otherwise.
const db_js_1 = require("./db.js");
const bot_js_1 = require("./bot.js");
const logger_js_1 = require("./logger.js");
async function targets(segment) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    if (segment === 'active7d') {
        const rows = await db_js_1.prisma.user.findMany({ where: { createdAt: { gte: sevenDaysAgo }, status: 'ACTIVE' }, select: { telegramId: true } });
        return rows.map((r) => r.telegramId);
    }
    if (segment === 'buyers') {
        const rows = await db_js_1.prisma.order.findMany({ where: { paymentStatus: 'PAID' }, select: { userId: true }, distinct: ['userId'] });
        return rows.map((r) => r.userId);
    }
    if (segment === 'neverBought') {
        const buyers = await db_js_1.prisma.order.findMany({ where: { paymentStatus: 'PAID' }, select: { userId: true }, distinct: ['userId'] });
        const set = new Set(buyers.map((b) => String(b.userId)));
        const rows = await db_js_1.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { telegramId: true } });
        return rows.map((r) => r.telegramId).filter((id) => !set.has(String(id)));
    }
    const rows = await db_js_1.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { telegramId: true } });
    return rows.map((r) => r.telegramId);
}
async function processBroadcast(broadcastId, segment = 'all') {
    const b = await db_js_1.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!b)
        return;
    await db_js_1.prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'SENDING', sentCount: 0 } });
    const ids = await targets(segment).catch(() => []);
    let sent = 0;
    for (const id of ids) {
        try {
            if (bot_js_1.bot)
                await bot_js_1.bot.api.sendMessage(String(id), `<b>${b.title}</b>\n\n${b.text}`, { parse_mode: 'HTML' });
            sent += 1;
        }
        catch (e) {
            logger_js_1.logger.warn({ e, id: String(id) }, 'broadcast send failed');
        }
        if (sent % 10 === 0)
            await db_js_1.prisma.broadcast.update({ where: { id: broadcastId }, data: { sentCount: sent } }).catch(() => null);
        await new Promise((r) => setTimeout(r, 40)); // ~25 msg/s, respect Telegram limits
    }
    await db_js_1.prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'DONE', sentCount: sent } }).catch(() => null);
    logger_js_1.logger.info({ broadcastId, sent }, 'broadcast done');
}
