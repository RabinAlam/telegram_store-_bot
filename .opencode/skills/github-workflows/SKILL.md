---
name: github-workflows
description: Use when working with GitHub — Actions CI, pull requests, branches, secrets, code reviews. Triggers on GitHub, Actions, CI, workflow, PR, push, pull_request, secrets, checkout.
---

# GitHub Workflows

GitHub project: `actions/checkout`, `actions/setup-node`

## When to Use
Use ONLY for GitHub — Actions CI/CD, PR workflow, branch protection, secrets, releases for Telegram Mini App / Next.js projects.

## Workflow
1. CI: `.github/workflows/ci.yml` — `on: [push, pull_request]`, `actions/checkout@v4`, `actions/setup-node@v4` (node 20 + npm cache), `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` if present.
2. Branches: `main` protected (require PR + passing CI), feature branches `feat/*`, `fix/*`; conventional commits; PR template with test plan.
3. Secrets: `BOT_TOKEN`, `NEXT_PUBLIC_WEBAPP_URL`, `VERCEL_TOKEN` in GitHub Secrets, never in code; use `${{ secrets.NAME }}` in workflows; `.gitignore` `.env*`.
4. CD: deploy on `push: branches: [main]` — Vercel / Netlify action, set BotFather menu button + domain to prod HTTPS URL after deploy.
5. Verify: `gh run list`, `gh pr checks`, green CI, preview URL works inside Telegram, no secrets in logs.

## Anti-Patterns
- Committing `.env` or bot tokens.
- Pushing directly to `main` bypassing PR checks.
- `npm install` in CI instead of `npm ci` with lockfile.
- Missing `permissions: contents: read` hardening.

## Reference
- Repo: https://github.com/actions/checkout
- Docs: https://docs.github.com/en/actions
