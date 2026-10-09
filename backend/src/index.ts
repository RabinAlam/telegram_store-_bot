import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { logger } from './logger.js';
import { registerBotHandlers } from './bot.js';
import { authRouter, adminsRouter } from './routes/auth.routes.js';
import { catalogRouter } from './routes/catalog.routes.js';
import { ordersRouter } from './routes/orders.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { referralsRouter } from './routes/referrals.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { broadcastRouter } from './routes/broadcast.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';
import { publicRouter } from './routes/public.routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const loginLimiter = rateLimit({ windowMs: 60_000, max: 20 });
app.use('/api/auth/login', loginLimiter);
app.use('/webhooks/', rateLimit({ windowMs: 60_000, max: 120 }));

app.use('/api/auth', authRouter);
app.use('/api/admins', adminsRouter);
app.use('/api', catalogRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/broadcasts', broadcastRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);
app.use('/webhooks', webhooksRouter);
app.use('/api/public', publicRouter);

try {
  const p1 = path.join(process.cwd(), 'src/openapi.yaml');
  const p2 = path.join(process.cwd(), 'dist/openapi.yaml');
  const f = fs.existsSync(p1) ? p1 : p2;
  if (fs.existsSync(f)) {
    const doc = YAML.parse(fs.readFileSync(f, 'utf8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(doc));
  }
} catch { /* docs optional in dev */ }
app.get('/openapi.json', (_req, res) => res.json({ openapi: '3.0.0', info: { title: 'TZ Store Admin API', version: '1.0.0' } }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'unhandled');
  res.status(500).json({ error: 'internal error' });
});

const port = Number(process.env.PORT ?? 4000);
registerBotHandlers();

// Never let a DB blip take the whole API down (Express 4 has no async guard)
process.on('unhandledRejection', (e) => logger.error({ e }, 'unhandled rejection (kept alive)'));
process.on('uncaughtException', (e) => logger.error({ e }, 'uncaught exception (kept alive)'));

// Broadcast queue worker (best-effort: skipped when Redis is unreachable)
void (async () => {
  try {
    const { Worker } = await import('bullmq');
    const { redis } = await import('./redis.js');
    const { processBroadcast } = await import('./broadcast.worker.js');
    await redis.ping();
    new Worker('broadcast', async (job) => {
      const { broadcastId, segment } = job.data as { broadcastId: string; segment: string };
      await processBroadcast(broadcastId, segment);
    }, { connection: redis });
    logger.info('broadcast worker started');
  } catch {
    logger.warn('broadcast worker disabled (no redis) — inline fallback active');
  }
})();

app.listen(port, () => logger.info(`TZ backend on :${port}`));
