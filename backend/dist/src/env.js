"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    PORT: zod_1.z.coerce.number().default(4000),
    BOT_TOKEN: zod_1.z.string().min(1),
    ADMIN_NOTIFY_CHAT_ID: zod_1.z.string().default(''),
    BINANCE_PAY_MERCHANT_ID: zod_1.z.string().default(''),
    BINANCE_PAY_API_KEY: zod_1.z.string().default(''),
    BINANCE_PAY_SECRET: zod_1.z.string().default(''),
    BINANCE_PAY_SANDBOX: zod_1.z.coerce.boolean().default(true),
    WEBAPP_URL: zod_1.z.string().default('http://localhost:3000'),
    API_PUBLIC_URL: zod_1.z.string().default('http://localhost:4000'),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:5173,http://localhost:3000'),
    SUPPORT_URL: zod_1.z.string().default('https://t.me/TZStoreSupport'),
    CHANNEL_URL: zod_1.z.string().default('https://t.me/TZStoreChannel'),
});
exports.env = envSchema.parse(process.env);
