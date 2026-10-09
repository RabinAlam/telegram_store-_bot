"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = __importDefault(require("pino-http"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const yaml_1 = __importDefault(require("yaml"));
const logger_js_1 = require("./logger.js");
const bot_js_1 = require("./bot.js");
const auth_routes_js_1 = require("./routes/auth.routes.js");
const catalog_routes_js_1 = require("./routes/catalog.routes.js");
const orders_routes_js_1 = require("./routes/orders.routes.js");
const payments_routes_js_1 = require("./routes/payments.routes.js");
const users_routes_js_1 = require("./routes/users.routes.js");
const referrals_routes_js_1 = require("./routes/referrals.routes.js");
const dashboard_routes_js_1 = require("./routes/dashboard.routes.js");
const broadcast_routes_js_1 = require("./routes/broadcast.routes.js");
const settings_routes_js_1 = require("./routes/settings.routes.js");
const audit_routes_js_1 = require("./routes/audit.routes.js");
const webhooks_routes_js_1 = require("./routes/webhooks.routes.js");
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use((0, cors_1.default)({ origin: origins.length ? origins : true, credentials: true }));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, pino_http_1.default)({ logger: logger_js_1.logger }));
app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
const loginLimiter = (0, express_rate_limit_1.default)({ windowMs: 60_000, max: 20 });
app.use('/api/auth/login', loginLimiter);
app.use('/webhooks/', (0, express_rate_limit_1.default)({ windowMs: 60_000, max: 120 }));
app.use('/api/auth', auth_routes_js_1.authRouter);
app.use('/api/admins', auth_routes_js_1.adminsRouter);
app.use('/api', catalog_routes_js_1.catalogRouter);
app.use('/api/orders', orders_routes_js_1.ordersRouter);
app.use('/api/payments', payments_routes_js_1.paymentsRouter);
app.use('/api/users', users_routes_js_1.usersRouter);
app.use('/api/referrals', referrals_routes_js_1.referralsRouter);
app.use('/api/dashboard', dashboard_routes_js_1.dashboardRouter);
app.use('/api/broadcasts', broadcast_routes_js_1.broadcastRouter);
app.use('/api/settings', settings_routes_js_1.settingsRouter);
app.use('/api/audit', audit_routes_js_1.auditRouter);
app.use('/webhooks', webhooks_routes_js_1.webhooksRouter);
try {
    const p1 = node_path_1.default.join(process.cwd(), 'src/openapi.yaml');
    const p2 = node_path_1.default.join(process.cwd(), 'dist/openapi.yaml');
    const f = node_fs_1.default.existsSync(p1) ? p1 : p2;
    if (node_fs_1.default.existsSync(f)) {
        const doc = yaml_1.default.parse(node_fs_1.default.readFileSync(f, 'utf8'));
        app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(doc));
    }
}
catch { /* docs optional in dev */ }
app.get('/openapi.json', (_req, res) => res.json({ openapi: '3.0.0', info: { title: 'TZ Store Admin API', version: '1.0.0' } }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    logger_js_1.logger.error({ err }, 'unhandled');
    res.status(500).json({ error: 'internal error' });
});
const port = Number(process.env.PORT ?? 4000);
(0, bot_js_1.registerBotHandlers)();
// Broadcast queue worker (best-effort: skipped when Redis is unreachable)
void (async () => {
    try {
        const { Worker } = await Promise.resolve().then(() => __importStar(require('bullmq')));
        const { redis } = await Promise.resolve().then(() => __importStar(require('./redis.js')));
        const { processBroadcast } = await Promise.resolve().then(() => __importStar(require('./broadcast.worker.js')));
        await redis.ping();
        new Worker('broadcast', async (job) => {
            const { broadcastId, segment } = job.data;
            await processBroadcast(broadcastId, segment);
        }, { connection: redis });
        logger_js_1.logger.info('broadcast worker started');
    }
    catch {
        logger_js_1.logger.warn('broadcast worker disabled (no redis) — inline fallback active');
    }
})();
app.listen(port, () => logger_js_1.logger.info(`TZ backend on :${port}`));
