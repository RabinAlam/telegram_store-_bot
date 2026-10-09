// Seed 16 TZ categories + samples: GitHub $10, CapCut $1.80, Gemini $0.75 tiers.
// Run: DATABASE_URL=... npm run db:push && npm run db:seed
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const CATS = [['github','GitHub','🐙',1],['capcut','CapCut','🎬',2],['grok','Grok','🤖',3],['canva','Canva','🎨',4],['chatgpt','ChatGPT','💬',5],['gemini','Gemini','✨',6],['claude','Claude','🧠',7],['email','Email','📧',8],['tz-vip','TZ VIP','👑',9],['youtube','YouTube','▶️',10],['muse-ai','Muse AI','♾️',11],['telegram-premium','Telegram Premium','✈️',12],['figma','Figma','🖌️',13],['vpn','VPN','🛡️',14],['duolingo','Duolingo','🦉',15],['leonardo','Leonardo AI','🎭',16]] as const;
async function main() {
  for (const [slug, name, emoji, sort] of CATS) {
    await db.category.upsert({ where: { slug }, update: { name, emoji, sort }, create: { slug, name, emoji, sort } });
  }
  const g = await db.category.findUniqueOrThrow({ where: { slug: 'github' } });
  const c = await db.category.findUniqueOrThrow({ where: { slug: 'capcut' } });
  const gm = await db.category.findUniqueOrThrow({ where: { slug: 'gemini' } });
  await db.product.upsert({ where: { id: 'seed-github' }, update: {}, create: { id: 'seed-github', categoryId: g.id, title: 'GitHub Student Developer Pack', desc: 'Student dev pack', contents: 'Invite link. ETA instant.', priceUsdt: 10.0, bulkTiers: [] } });
  await db.product.upsert({ where: { id: 'seed-capcut' }, update: {}, create: { id: 'seed-capcut', categoryId: c.id, title: 'CapCut Pro Team 1M', desc: 'Team seat 1M', contents: 'Invite link. ETA instant.', priceUsdt: 1.8, bulkTiers: [{ minQty: 1, unitPrice: 1.8 }, { minQty: 5, unitPrice: 1.65 }] } });
  await db.product.upsert({ where: { id: 'seed-gemini' }, update: {}, create: { id: 'seed-gemini', categoryId: gm.id, title: 'Gemini 18 Months', desc: 'Upgrade code', contents: 'Redeem code. ETA instant.', priceUsdt: 0.75, bulkTiers: [{ minQty: 1, unitPrice: 0.75 }, { minQty: 6, unitPrice: 0.7 }, { minQty: 16, unitPrice: 0.65 }] } });
  console.log('seed ok');
}
main().finally(() => db.$disconnect());
