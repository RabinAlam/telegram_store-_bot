---
name: tma-nextjs-template
description: Use when scaffolding Telegram Mini App with Next.js TypeScript template, mockTelegramEnv dev, TON, and Vercel deploy. Triggers on nextjs-template, mockTelegramEnv, useTelegramMock, TMA template.
---

# TMA Next.js Template Scaffold

GitHub project: `Telegram-Mini-Apps/nextjs-template`

## When to Use
Use to start production Mini App — Next.js + TS + `@telegram-apps/sdk-react` + TelegramUI + TON Connect prewired.

## Workflow
1. Scaffold: `git clone https://github.com/Telegram-Mini-Apps/nextjs-template` or `npx create-tma@latest`; `npm i`.
2. Structure: `src/app/layout.tsx` (SDKProvider + TonConnectUIProvider), `src/hooks/useTelegramMock.ts` (`mockTelegramEnv` in dev only), `src/components/Root.tsx`.
3. Dev: `npm run dev` with mock for browser; real test via BotFather URL in Telegram mobile/desktop.
4. Env: `NEXT_PUBLIC_WEBAPP_URL` (HTTPS), `BOT_TOKEN` server-only; `tonconnect-manifest.json` in `public/`.
5. Verify: `npm run build && npm run lint && npm run typecheck`; deploy Vercel/Netlify HTTPS; set BotFather domain + menu button to prod URL.

## Anti-Patterns
- Shipping `mockTelegramEnv` in production build.
- `BOT_TOKEN` with `NEXT_PUBLIC_` prefix.
- Testing only in desktop browser, never in Telegram clients.

## Reference
- Repo: https://github.com/Telegram-Mini-Apps/nextjs-template
- Docs: https://docs.telegram-mini-apps.com/
