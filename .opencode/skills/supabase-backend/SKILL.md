---
name: supabase-backend
description: Use when adding auth, Postgres, storage, or realtime to websites with Supabase SSR helpers and RLS policies. Triggers on Supabase, createClient, RLS, storage bucket.
---

# Supabase Backend

GitHub project: `supabase/supabase`

## When to Use
Use for quick backends — auth, newsletter DB, file uploads, realtime comments — without managing servers.

## Workflow
1. Setup: `npm i @supabase/supabase-js @supabase/ssr`; `NEXT_PUBLIC_SUPABASE_URL` + anon key client-side, service key server-only.
2. Auth: SSR `createServerClient` in middleware/layout; OAuth + magic link; protected routes redirect unauth.
3. Data: tables with RLS (`auth.uid() = user_id` policies); queries with `.select().eq().limit()`; storage buckets with size/type limits.
4. Realtime: subscribe only where needed, unsubscribe on unmount.
5. Verify: RLS denies anon write test, upload validates type, `npm run build` clean.

## Anti-Patterns
- Disabling RLS to "fix" permission errors.
- Service-role key in client bundle.
- Unbounded `.select('*')` without limits.

## Reference
- Repo: https://github.com/supabase/supabase
