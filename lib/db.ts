// Prisma client (lazy). Works without DATABASE_URL at build time.
// Run `npx prisma generate` + `npm run db:push` when deploying with Postgres.
import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { __prisma?: PrismaClient };
export function db(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (!g.__prisma) g.__prisma = new PrismaClient();
  return g.__prisma;
}
