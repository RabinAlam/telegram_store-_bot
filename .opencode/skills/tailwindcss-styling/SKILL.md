---
name: tailwindcss-styling
description: Use when styling websites with Tailwind CSS utilities, theming, responsive design, or dark mode. Triggers on Tailwind, utility classes, tailwind.config, @apply.
---

# Tailwind CSS Styling

GitHub project: `tailwindlabs/tailwindcss`

## When to Use
Use when adding or fixing Tailwind styling, design tokens, responsive layouts, dark mode, or typography.

## Workflow
1. Setup v4 (`@import "tailwindcss"`) or v3 (`tailwind.config.js` + directives). Prefer CSS-first `@theme` tokens in v4.
2. Tokens: colors, spacing, fonts, radii in one place; max 2 font families; use `max-w-7xl mx-auto px-4` containers, never fixed px page widths.
3. Responsive: mobile-first `sm: md: lg: xl:`; test 360/768/1024/1440px; tap targets ≥44px; contrast ≥4.5:1.
4. Dark mode: `dark:` variant (`class` strategy if toggle needed).
5. Verify: `npm run build` compiles, no horizontal scroll, focus-visible states present.

## Anti-Patterns
- Excessive `@apply` for one-off utilities.
- Arbitrary values everywhere instead of tokens.
- Skipping `alt`, labels, focus styles.

## Reference
- Repo: https://github.com/tailwindlabs/tailwindcss
