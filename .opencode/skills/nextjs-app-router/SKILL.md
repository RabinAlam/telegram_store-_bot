---
name: nextjs-app-router
description: Use when building websites with Next.js App Router, Server Components, routing, metadata, or Vercel deployment. Triggers on Next.js, app/, page.tsx, layout.tsx.
---

# Next.js App Router Websites

GitHub project: `vercel/next.js`

## When to Use
Use ONLY when building or fixing a Next.js App Router site. Covers `app/` routing, layouts, loading/error states, Server vs Client Components, metadata/SEO, image/font optimization, Route Handlers, Server Actions.

## Workflow
1. Scaffold: `npx create-next-app@latest` (App Router, TypeScript, Tailwind, ESLint).
2. Structure:
   - `app/layout.tsx` — single root layout, fonts, meta
   - `app/page.tsx` — landing page composition
   - `app/(marketing)/...` — route groups, `loading.tsx`, `error.tsx`, `not-found.tsx`
3. Data: Server Components fetch by default; use `fetch` with `next: { revalidate }`; mutations via Server Actions (`"use server"`).
4. SEO/perf: `export const metadata` per page, `next/image` (AVIF/WebP, width/height), `next/font` with `display: swap`.
5. Verify: `npm run build && npm run lint && npm run typecheck`.

## Anti-Patterns
- Adding `"use client"` everywhere — keep leaf components client-only.
- `getServerSideProps` in App Router (that's Pages Router API).
- Committing `.env` — set envs in Vercel dashboard.
- Fixed-px containers causing horizontal scroll.

## Reference
- Repo: https://github.com/vercel/next.js
- Docs: `app/` routing, metadata API, `next/image`, `next/font`.
