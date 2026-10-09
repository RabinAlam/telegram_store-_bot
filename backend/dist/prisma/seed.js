"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const CATS = [
    ['GitHub', '🐙', 1], ['CapCut', '🎬', 2], ['Grok', '🤖', 3], ['Canva', '🎨', 4],
    ['ChatGPT', '💬', 5], ['Gemini', '✨', 6], ['Claude', '🧠', 7], ['Email', '📧', 8], ['TZ VIP', '👑', 9], ['YouTube', '▶️', 10], ['Muse AI', '♾️', 11], ['Telegram Premium', '✈️', 12],
    ['Figma', '🖌️', 13], ['VPN', '🛡️', 14], ['Duolingo', '🦉', 15], ['Leonardo AI', '🎭', 16],
];
async function main() {
    for (const [name, emoji, sortOrder] of CATS) {
        await prisma.category.upsert({ where: { name }, update: { emoji, sortOrder }, create: { name, emoji, sortOrder } });
    }
    const hash = await bcryptjs_1.default.hash('Admin@123', 12);
    await prisma.admin.upsert({
        where: { email: 'admin@tzstore.io' },
        update: { role: 'SUPER_ADMIN' },
        create: { email: 'admin@tzstore.io', passwordHash: hash, role: 'SUPER_ADMIN' },
    });
    const defaults = {
        referralPercent: 5, supportUrl: 'https://t.me/TZStoreSupport', channelUrl: 'https://t.me/TZStoreChannel',
        minDeposit: 1, manualAddresses: { TRC20: '', BEP20: '' }, botToken: '', binanceMerchantId: '', binanceApiKey: '', binanceSecret: '',
    };
    for (const [key, value] of Object.entries(defaults)) {
        await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: value } });
    }
    console.log('seed ok: 16 categories + admin@tzstore.io / Admin@123');
}
main().finally(() => prisma.$disconnect());
