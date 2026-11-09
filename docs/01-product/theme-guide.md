# Agendal theme guide — Graphite (V2.1)

Nov 1, 2026

Graphite is Agendal's theme: the V1 layout language (grey grouped background, white rounded cards, large bold titles, iOS-like lists, round checkboxes, a pill capture bar above a 4-tab bar, a sidebar and right panel on desktop) in a **monochrome palette** built from `#252525 · #545454 · #7D7D7D · #CFCFCF`, in light and dark. It replaces Paper & ink (see git history before 2026-11-01). The concept is unchanged: notes become tasks; there is no chat with an assistant.

The reference package (screens, PNGs, icons, `tokens.json`, `tokens.css`, `agendal.css`) is **not in git**. Open it on the [shared design canvas](https://claude.ai/artifact/7oh8WVhMsXQZ64KpKNmm9b) and ask the owner for access. Map it onto the existing components; do not copy the static HTML. Fonts: **Inter** 400/500/600/700.

## Colour

Rules:
- Neutral greys do almost all the work. The accent **is ink** by default: primary buttons, selected chips and the progress ring are `#252525` in light and `#CFCFCF` in dark.
- **Theme Palettes:** The primary accent colour can be customized via 8 theme palettes (`Default` Graphite `#252525`, `Agendal` Red `#dc2626`, `Moonstone` Blue `#3b82f6`, `Tangerine` `#f97316`, `Kale` Green `#16a34a`, `Blueberry` `#2563eb`, `Lavender` `#8b5cf6`, `Raspberry` `#db2777`). Selecting a palette dynamically overrides the CSS variable `--color-primary`, immediately recolouring active navigation highlights (`bg-primary/15! text-primary! font-semibold`), checkboxes, and focus rings.
- Status colours are muted and appear only with a word or icon: red = overdue / destructive, amber = "needs your OK", green = "Created" badges and success. Project colours appear only as 7–8px dots, thin progress bars and small icon tiles.
- Links that sit inside text are underlined (the accent is the same colour as body text).
- Every text colour passes WCAG 4.5:1 in both themes; field borders pass 3:1.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#F2F2F2` | `#1A1A1A` | Page background (grouped-list grey) |
| `card` | `#FFFFFF` | `#252525` | Cards, lists, sidebar, panels |
| `raised` | `#FFFFFF` | `#2E2E2E` | Capture bar, dialogs, toasts |
| `fill` | `#E6E6E6` | `#333333` | Quiet buttons, unselected chips, segmented track, icon buttons |
| `fill2` | `#CFCFCF` | `#545454` | Progress tracks, sheet grabber, ruled lines on the note paper |
| `ink` | `#252525` | `#EDEDED` | Primary text, titles, done-checkbox fill |
| `ink2` | `#545454` | `#A6A6A6` | Secondary text, meta, labels, inactive tabs |
| `ink3` | `#7D7D7D` | `#7D7D7D` | Icons, empty checkbox ring, placeholders only (not body text) |
| `sep` | `#E1E1E1` | `#363636` | 1px hairlines between rows |
| `border` | `#7D7D7D` | `#7D7D7D` | 1px border on text fields and the note editor |
| `accent` | `#252525` | `#CFCFCF` | Primary button, active tab/nav, selected chip, ring, links |
| `accent-tint` | `#E6E6E6` | `#363636` | Tinted buttons (Undo all), selected nav row, highlighted list row |
| `on-accent` | `#FFFFFF` | `#252525` | Text/icons on `accent` |
| `danger` / `danger-text` / `danger-tint` / `on-danger` | `#C9372C` / `#B3261E` / `#F8E4E2` / `#FFFFFF` | `#F07068` / `#FF8A80` / `#3A2321` / `#1A1A1A` | Overdue, delete, high priority flag, DELETED badge |
| `success` / `success-text` / `success-tint` | `#3F8F5A` / `#2E6B43` / `#E5EFE8` | `#6FBF8A` / `#7FCB98` / `#1F3326` | CREATED badge, "tasks created" label |
| `warning` / `warning-text` / `warning-tint` | `#C27C0E` / `#8A5300` / `#F5ECDC` | `#E0A443` / `#F0B860` / `#3A2E18` | "Needs your OK" box border, medium priority flag |
| `bar` | `rgba(242,242,242,.94)` | `rgba(26,26,26,.94)` | Tab bar / bottom bars (with backdrop blur if you can) |
| `scrim` | `rgba(0,0,0,.32)` | `rgba(0,0,0,.6)` | Behind sheets and dialogs |
| `navy` / `navy2` (name kept from V1) | `#252525` / `#333333` | same | Desktop sign-in brand panel and its inner card |
| `p-blue … p-gray` | `#5B7FB5 #B9564D #C78A3C #5E9670 #8B6BAE #7D7D7D` | `#7C9CCB #D07168 #D9A05A #7DB08D #A68BC4 #7D7D7D` | Project colours: SQL Course, Adv Web, HCI, Portfolio, Personal, No project |

---

## Type, shape, spacing

**Type (Inter):**

| Style | Spec | Where |
| --- | --- | --- |
| Large title | 700 · 28/34 · −0.02em | Screen titles (Inbox, Upcoming, Projects, Notes), note name on result screen |
| Title 2 | 700 · 22/28 · −0.015em | Task title in details, sign-in heading, desktop note name |
| Title 3 | 600 · 17/22 | Card headings ("This needs your OK") |
| Section header | 700 · 17/22, count in 400 `ink2` | "Overdue 1", "Today 4", day headers |
| Body / task title | 400 · 15/20 | Rows, fields |
| Body 2 | 400 · 13/18 `ink2` | Subtitles, excerpts |
| Small / meta | 400 · 12/16 `ink2` | Task meta line, helper text |
| Overline | 600 · 11/14 · uppercase · +0.03em `ink2` | Date above titles, "TRY WRITING", group labels |
| Tab label | 500 · 10/12 | Tab bar |
| Button | 600 · 15 (sm 13, xs 12) | Buttons |

**Radius:** cards 12 · buttons 12 (small/xs buttons and chips are pills) · fields 10 · badges 5 · icon tiles 7 · note editor 14 · sheets 14 (top) · dialogs 16.
**Spacing:** 4px grid. Mobile side margin 16; gap between cards/sections 12; row padding 9×14, min row height 52. Desktop main padding 22×28; sidebar 200–240px; right panel 300–400px.
**Elevation:** flat. Only the capture bar (`0 2px 14px rgba(0,0,0,.08)`), sheets/dialogs/toasts (`0 18px 50px rgba(0,0,0,.18)`) cast shadows.
**Sizes:** buttons 44 (sm 34, xs 28) · fields 44 · checkbox 22 with a 44px hit area · icon buttons 32 · FAB 44 · capture bar 44 · tab bar 62 · nav bar 44.

---

## Theming

- Light is default. Dark applies via a class/attribute on the root (`.ag.dark` in the reference CSS; `[data-theme="dark"]` in `tokens/tokens.css`, `data-theme="agendal-light"` or `data-theme="agendal-dark"` on `<html>`) or by system preference.
- Every colour in components must come from a token — no hard-coded hex in components (the only exceptions are the desktop sign-in illustration and project colours, which are fixed per theme).
- Keep the user's "Dark mode" toggle in Settings > Theme (Light / Dark / System).
- **Circular Reveal Transition:** Theme toggle transitions animate using the native View Transitions API (`document.startViewTransition`). The transition animates `::view-transition-new(root)` expanding a `clip-path: circle(...)` from the pointer coordinates `(clientX, clientY)` to the maximum viewport radius (calculated via `Math.hypot`), lasting 450ms with easing `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Pulse Ripple Feedback:** Selecting a theme palette card triggers an expanding keyframe pulse ripple micro-interaction around the card.
- **Motion Accessibility:** Automatically respects `@media (prefers-reduced-motion: reduce)` by disabling circular reveal and pulse animations.
- **Zero-Flash Blocking Script:** `src/app/layout.tsx` uses `<Script src="/theme.js" strategy="beforeInteractive" />` from `next/script` in `<head>` to read stored preferences and set `data-theme` prior to first paint without triggering React 19 client render script errors.

---

## Components

Class names refer to `css/agendal.css` in the canvas package.

| Component | Anatomy and rules |
| --- | --- |
| **Screen header** (mobile) | Overline date left; round 32px Search and Account (initial) buttons right; large title below. |
| **Summary card** | White card: 44px progress ring (track `fill2`, value `accent`, "1/5" centred) + "Nice pace!" (600) + "1 of 5 done · next: …" (body 2). |
| **Section header** `.sec` | Title + count. Overdue uses `danger-text`. |
| **List card** `.card.list` | Rows directly in a 12px-radius white card, 1px `sep` hairlines between rows. |
| **Task row** `.row` | 22px round checkbox (ring `ink3`; overdue ring `danger`; done = `ink` fill with check in `card` colour) · title 15/20 (done: `ink3` + strikethrough) · meta line: project dot · project · time · bell/repeat icons · optional "✦ From a note" · trailing priority flag (High `danger`, Medium `warning`). Highlighted/selected row uses `accent-tint` background. |
| **Capture bar** `.composer` | 44px pill on `raised` with `sep` border + shadow: sparkle icon, placeholder "Write a note — I'll make the tasks" (ellipsis when tight), round mic button (`accent-tint`). Sits above the tab bar with a 44px round **+ FAB** (`accent`) to its right for manual tasks. **Layout must be `grid-template-columns: minmax(0,1fr) 44px`** so the FAB never overflows. On Upcoming the placeholder is an example ("e.g. move Friday's tasks to Monday"). |
| **Tab bar** `.tabbar` | 4 tabs: Inbox, Upcoming, Projects, Notes. 22px icon + 10px label, `ink2`; active = `accent`. |
| **Nav bar** `.nav` | 44px: back link "‹ Notes/Inbox" (accent) left, title centre (optional sparkle), action right (⋯). |
| **Buttons** `.btn` | Primary (`accent` / `on-accent`), tint (`accent-tint` / `accent`), ghost (`fill` / `ink`), red (`danger` / `on-danger`), red-tint (`danger-tint` / `danger-text`). Sizes 44 / 34 pill / 28 pill. One primary per screen. |
| **Chips** `.chip` | 28px pills; default `accent-tint`; `.ghost` = `fill`; selected = `accent` / `on-accent`. Used for filters and "Try writing" examples. |
| **Segmented** `.seg` | `fill` track, selected segment `card` with small shadow. Priority Low/Medium/High; Upcoming All/Scheduled/Due only (desktop). |
| **Field** `.field` | 44px, `card` bg, 1px `border`, radius 10, leading icon `ink2`, label above (12/16 500). |
| **Badges** `.badge` | 18px uppercase 10px/700: CREATED (success tint), CHANGED (accent tint), DELETED (danger tint), NEW. |
| **Banners** `.banner` | Tinted 12px-radius boxes with icon + bold line + body: info (`accent-tint`), warn, err, ok. |
| **Note paper** (note editor) | White card, label "Your note", note text 17/25 on **ruled lines** (1px `fill2` every 25px, aligned under each text line), card min-height 286px. |
| **Change row** `.change` | Badge · bold title · meta · pencil edit link. Grouped in a card under an overline "✓ 3 TASKS CREATED". |
| **Needs-OK box** `.okbox` | 1.5px `warning` border, 14px radius: alert icon + "This needs your OK", consequence line, change rows on `bg`, buttons Cancel (ghost) + "Apply N changes" (red). |
| **File chip** `.filechip` | 34px tinted file icon, name (600) + "234 KB · 2 pages", remove (×) button. |
| **Voice sheet** | Bottom sheet over a scrim: "● Listening… 0:04", waveform bars (`accent`), "Live transcript" card, × (discard) and red stop button with a soft ring. |
| **Sidebar** (desktop) `.side` | Logo mark (links to Inbox) + "Agendal", search button with Ctrl+K, dynamic `sortedTabs` with counts (Inbox, Upcoming, Projects, Notes; active = `bg-primary/15! text-primary! font-semibold` matching active Theme Palette), "PROJECTS" list with dots and counts, user row (avatar, name, email, settings) pinned bottom. Custom order, tab toggles and count badges configured in Settings > Sidebar. |
| **Settings modal** `.settings` | 2-pane Todoist-style dialog (`surface`, `rounded-2xl`, max 960px): left sub-navigation rail with category icons and search filtering, right content pane, custom select dropdowns, backdrop blur (`bg-scrim/60 backdrop-blur-[2px]`), and body scroll lock (`useBackgroundScrollLock`). |
| **Page View modes** | `Flat view` (default, 800px centred column on wide screens, 1 project per row, task details in a centred popup modal `variant="popup"`) vs `Full width` (fluid multi-column grid, task details in right side panel `variant="panel"`). Configured in Settings > General. |
| **Notes panel** (desktop) `.panel` | Right column, header "✦ Notes". Body on `bg`: latest note cards (time · "3 tasks made", note name, quoted note, change rows, Undo all / Open note), older notes collapsed to one row. Footer: note editor (text, mic, paperclip, Ctrl+Enter hint, "Make tasks") and a line "Agendal makes, changes and schedules tasks from your notes. Every change can be undone." The same panel shows Task details or a selected note when those are open. |
| **Logo** | V1 mark: rounded square in `ink` with a check in `bg` (desktop sign-in: inverted on the dark brand panel). |

Icons (`icons/`): inbox, calendar, folder, note, search, mic, clip (paperclip), plus, sparkles, chev-l/r/d, flag, bell, repeat, clock, check, x, undo, more, file, trash, pencil, send, wifi-off, alert, mail, lock, eye, sliders, filter, keyboard, settings. Meanings: **sparkles** = something Agendal did / the note feature; **note** = Notes tab; **clip** = a note from a file; **flag** = priority.

## Screens

The canvas holds 11 mobile and 7 desktop screens per theme, named `mobile-…` and `desktop-…` (sign-in, inbox, new note, voice, from a file, note result, needs your OK, unclear note, notes, task details, upcoming, projects). Layout and copy come from [screens](screens.md) and [UX standards](ux-standards.md); the canvas is the pixel reference.

## Accessibility

- Text ≥ 4.5:1 and control borders ≥ 3:1 in both themes (the tokens are chosen for this; don't lighten `ink2`, and use `ink3` only for icons/placeholders).
- Touch targets ≥ 44px (checkboxes keep a 44px invisible hit area). Icon-only buttons need `aria-label`.
- Focus: 2px `accent` outline with 2px offset on every interactive element.
- Colour never carries meaning alone: priorities have flags + labels, statuses have words, badges have text.
- Decorative art (sign-in illustration) is hidden from screen readers.

## Removed V1 features

Do not build or keep: assistant chat and chat bubbles, "Which task do you mean?" pickers, splitting a task into steps, "find time to study" suggestions, underlined uncertain words, "type instead" during dictation, V1's Settings/Motivation pages (accent colour picker, encouragement/nudge toggles, morning summary).
