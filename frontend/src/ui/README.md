# Agendal UI (src/ui)

Agendal design system (IM-06) on Tailwind CSS and daisyUI: the Paper & ink tokens as the `agendal-light` and `agendal-dark` daisyUI themes, and base components styled to the theme guide sizes. Spec: [theme guide](../../../docs/01-product/theme-guide.md), [UX standards](../../../docs/01-product/ux-standards.md).

## Use

`src/app/globals.css` imports [`theme.css`](theme.css), which loads Tailwind CSS, daisyUI and both themes. Then import the components:

```tsx
import { Button, Toast } from "@/ui";
```

Instrument Sans and Newsreader load through `next/font` in `src/app/layout.tsx`, which serves them from the app; `theme.css` reads them as `--font-instrument-sans` and `--font-newsreader`.

Set `data-theme="agendal-light"` or `"agendal-dark"` on `<html>` to force a theme; with no attribute the system setting decides.

Token utilities beside daisyUI's roles: `bg-surface`, `bg-fill`, `border-control`, `border-separator`, `text-ink-secondary`, `text-ink-tertiary`, `bg-primary-tint`, `bg-danger-tint`, `bg-project-blue` …, the type scale (`text-display`, `text-title`, `text-heading`, `text-footnote`, `text-overline` with `font-semibold uppercase` …; Tailwind's own `overline` class draws a line, so don't use it), radii (`rounded-field`, `rounded-tile`, `rounded-sheet` …), `focus-ring`, and `px-gutter` / `px-safe` for side margins with safe areas (UX-25), `px-gutter-wide` for the 40px margins from 768px (UX-27). Motion uses `motion-safe:` / `motion-reduce:` (UX-50–UX-52).

Components take every visible string as a prop (`closeLabel`, `actionLabel`, …). Pass text from the [copy catalog](../../../docs/01-product/copy-catalog.md), never inline strings.

| Component        | Notes                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | `primary` / `secondary` / `outline` / `destructive`, sizes `lg` / `md` / `sm`. `busy` shows a spinner and ignores taps (UX-06)                                                                             |
| `IconButton`     | 44px round, `label` required (NF-2)                                                                                                                                                                        |
| `TextField`      | Label, helper and error wired with `aria-describedby`. The caller decides when to show errors (UX-07). `trailing` puts a control inside the field                                                          |
| `Chip`           | Toggle with `aria-pressed`; selected is ink, not blue. 44px tap area                                                                                                                                       |
| `Sheet`          | Bottom sheet: × to close, accent confirm on the right. Focus first field or title, trap, Escape, focus returns (UX-10, UX-11)                                                                              |
| `Dialog`         | `alertdialog` for confirmations; focus starts on the title, never on a destructive button                                                                                                                  |
| `Toast`          | One at a time, 5 s, pauses on hover/focus/touch (UX-04). Polite live region, `assertive` for blocking errors (UX-60)                                                                                       |
| `AppShell`       | Below 768px: centred 600px column, capture bar and tab bar fixed at the bottom above the keyboard (UX-20, UX-24). From 768px: `sidebar`, 712px column (UX-27). From 1280px: optional `aside` panel (UX-28) |
| `Sidebar`        | Mark, Search, the four tabs with `counts`, a `projects` slot, account at the bottom. One `nav` landmark named "Menu"                                                                                       |
| `EmptyState`     | Serif title, body, optional action                                                                                                                                                                         |
| `PROJECT_COLORS` | The 8 project colours, used as `var(--color-project-<name>)` or `bg-project-<name>`                                                                                                                        |

## Test

```bash
npm test          # component tests + axe in both themes + token contrast
npm run typecheck
```

jsdom has no layout, so axe's `color-contrast` rule is off in component tests; `tests/ui/tokens.test.ts` checks NF-1 contrast directly from the two themes in `theme.css`.
