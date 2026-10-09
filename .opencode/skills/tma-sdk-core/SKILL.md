---
name: tma-sdk-core
description: Use when building Telegram Mini App frontend with @telegram-apps/sdk init, theme, viewport, backButton, haptics, cloudStorage. Triggers on Mini App, WebApp, init(), miniApps, themeParams.
---

# TMA SDK Core

GitHub project: `Telegram-Mini-Apps/telegram-apps` (`packages/sdk`)

## When to Use
Use ONLY for Telegram Mini App client init and native features — `init()`, `miniApp.ready()`, themeParams, viewport, backButton, mainButton, haptics, cloudStorage, closingBehavior.

## Workflow
1. Install: `npm i @telegram-apps/sdk`; NEVER also load `telegram-web-app.js` — pick one, mixing causes bugs.
2. Init order in `app/layout.tsx` or `main.tsx`:
   ```ts
   import { init, miniApp, themeParams, viewport, backButton } from '@telegram-apps/sdk';
   init();
   miniApp.ready(); miniApp.setHeaderColor('#000000');
   if (themeParams.isMounted()) themeParams.bindCssVars();
   if (viewport.mount.isAvailable()) { await viewport.mount(); viewport.expand(); viewport.bindCssVars(); }
   ```
3. Features: `backButton.show()/hide()` with router, `haptics.notificationOccurred('success')`, `cloudStorage.setItem()`, `closingBehavior.enableConfirmation()`.
4. Mock dev: `import { mockTelegramEnv } from '@telegram-apps/sdk'` ONLY in dev (`useTelegramMock.ts`), never ship mock in prod.
5. Verify: test inside Telegram (Android/iOS/Desktop), `npm run build` clean, no `window.Telegram` direct access.

## Anti-Patterns
- Calling SDK methods before `init()` / `mount()`.
- Using `telegram-web-app.js` + `@telegram-apps/sdk` together.
- Shipping `mockTelegramEnv` in production build.
- Fixed colors ignoring `themeParams` dark/light.

## Reference
- Repo: https://github.com/Telegram-Mini-Apps/telegram-apps
- Docs: https://docs.telegram-mini-apps.com/packages/telegram-apps-sdk/2-x
