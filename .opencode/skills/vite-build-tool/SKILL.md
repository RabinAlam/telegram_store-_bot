---
name: vite-build-tool
description: Use when scaffolding or optimizing Vite frontends, HMR, plugins, env vars, or production builds. Triggers on Vite, vite.config, HMR, build rollup.
---

# Vite Build Tool

GitHub project: `vitejs/vite`

## When to Use
Use for Vite + React/Vue/Svelte/TS sites — dev HMR, `vite.config.ts`, env handling, code-splitting, static deploy.

## Workflow
1. Scaffold: `npm create vite@latest` (react-ts / vue-ts); keep `index.html` at root as entry.
2. Config: `plugins: [react(), tsconfigPaths()]`, `server: { port }`, `build: { sourcemap, chunkSizeWarningLimit }`; envs as `VITE_*` + `import.meta.env`.
3. Assets: `public/` for verbatim, `src/assets/` for hashed; images WebP/AVIF with width/height; lazy-load below fold.
4. Split: `React.lazy()` for routes, `manualChunks` for vendor if needed.
5. Verify: `npm run build && npm run preview`, `tsc --noEmit`, Lighthouse no-CLS.

## Anti-Patterns
- Committing `.env`.
- Importing all of lodash/moment instead of tree-shaken utils.
- Absolute local paths that break on deploy.

## Reference
- Repo: https://github.com/vitejs/vite
