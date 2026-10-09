---
name: shadcn-ui-kit
description: Use when building accessible UI with shadcn/ui, Radix primitives, buttons, dialogs, forms, tables, or theming. Triggers on shadcn, components/ui, Radix, cva.
---

# shadcn/ui Kit

GitHub project: `shadcn-ui/ui`

## When to Use
Use when adding accessible components (button, dialog, dropdown, form, table, sheet, toast) with Tailwind + Radix + cva.

## Workflow
1. Init: `npx shadcn@latest init` (New York style, CSS variables, lucide icons).
2. Add: `npx shadcn@latest add button dialog form input table sheet sonner` — components land in `components/ui/`.
3. Compose: wrap in `app/layout.tsx` with `ThemeProvider`; use `cva` variants + `cn()` merge; forms with React Hook Form + Zod.
4. A11y: real `<label>`, `aria-describedby` errors, focus trap in dialogs, keyboard nav, contrast check.
5. Verify: `npm run build && npm run lint`, test keyboard-only + 360px mobile.

## Anti-Patterns
- Editing `components/ui/` primitives directly instead of wrapping.
- Icon-only buttons without `aria-label`.
- Client validation only.

## Reference
- Repo: https://github.com/shadcn-ui/ui
