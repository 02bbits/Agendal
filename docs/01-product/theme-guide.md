# Agendal theme guide — Paper & ink

Oct 23, 2026 · @Xeno

Paper & ink is Agendal's theme: a calm, flat notebook look — warm paper, black ink and one blue pen — for a mobile web app in light and dark. Everything below is the full spec needed to reproduce it.

## Art direction

Screens look like a calm notebook: mostly paper and whitespace, black ink for text, and one blue pen for the single thing to do next. The style is flat — no gradients, no decorative shadows, no cards around lists. Lists sit directly on the paper, divided by thin hairlines.

Colour follows a strict **60 · 30 · 10** split:

| Share | Role | Tokens | Rule |
| --- | --- | --- | --- |
| 60% | Paper | `bg` | The ground of every screen. |
| 30% | Ink and neutrals | `ink`, `ink-secondary`, `ink-tertiary`, `surface`, `fill`, `separator` | Text, things you write in or act on, quiet controls, hairlines. |
| 10% | Blue accent | `accent` | Only the one primary action per screen, the active tab, links, focus, progress, and the chosen option in a sheet. |

If a screen looks blue, there is too much blue. Selected chips and ticked checkboxes use ink, not blue. Status colours (danger, warning, success) appear only alongside a word or icon, never as decoration. Project colours appear only as 8px dots, thin progress bars or small tiles.

## Colour

Every text colour passes WCAG 4.5:1 in both themes, and field borders reach 3:1. Contrast figures are measured against `bg`.

**Paper and surfaces**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | #F6F5F1 | #121211 | Paper, the 60%. Ground of every screen. |
| `surface` | #FFFFFF | #1C1B19 | Things you write in or act on: fields, note editor, sheets, dialogs, capture bar, toasts. Never plain lists. |
| `surface-elevated` | #FFFFFF | #22211E | Overlays above `surface` (dialogs, menus, toasts); one step lighter in dark. |
| `fill` | #ECEAE4 | #262522 | Quiet controls: unselected chips, secondary buttons, segmented track, round icon buttons, progress tracks. |
| `fill-thumb` | #FFFFFF | #3A3935 | Selected segment of a segmented control. |
| `separator` | #E2DFD7 | #2C2B28 | 1px hairlines between rows and sections. Decorative only. |
| `card-edge` | #E2DFD7 | #2C2B28 | Edge of the few boxed elements (summary block, banners). |
| `control-border` | #8A867C | #77736A | 1px border of fields, the note editor and outline buttons (3.3:1 light, 4.0:1 dark). |
| `bar` | rgba(246,245,241,0.92) | rgba(18,18,17,0.92) | Tab bar and sticky headers, with a backdrop blur. |
| `scrim` | rgba(27,26,23,0.32) | rgba(0,0,0,0.6) | Dims the screen behind sheets and dialogs. |

**Ink (text)**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `ink` | #1B1A17 | #F2F0EA | Primary text, titles, task names, icons, ticked checkbox fill (16:1 light, 16.5:1 dark). |
| `ink-secondary` | #57544D | #B5B1A7 | Meta: project names, times, labels, row values, inactive tabs (6.9:1, 8.8:1). |
| `ink-tertiary` | #6B675F | #9A968C | Placeholders, counts, timestamps, finished tasks, empty checkbox ring (5.2:1, 6.4:1). |

**Accent and status**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `accent` | #2F5BD3 | #8FADFF | The 10%: primary action, active tab, links, selection, focus, progress (5.4:1, 8.6:1). |
| `accent-tint` | #E8EDFB | #1D2640 | Soft accent fill: note result summary, install banner. Text on it is `accent`. |
| `on-accent` | #FFFFFF | #0E1630 | Text and icons on solid `accent` or `danger` fills. |
| `danger` | #B42318 | #FF8A7F | Overdue, errors, destructive actions, high priority (6.0:1, 8.2:1). |
| `danger-tint` | #FBEAE8 | #3A1D1A | Delete button, error banner, DELETED badge. |
| `success` | #2F7A4B | #7DD19C | Success messages, CREATED badges (4.8:1, 10.2:1). Done tasks use ink, not green. |
| `success-tint` | #E6F1EA | #16301F | CREATED badge, success banner. |
| `warning` | #8A5300 | #F0B45A | Medium priority, offline state (5.8:1, 10.2:1). |
| `warning-tint` | #F6EDDC | #33270F | Offline banner. |

**Project colours** (same in both themes; only as 8px dots, thin progress bars or tiles — never text or large fills)

| Token | Value | Example project |
| --- | --- | --- |
| `project-blue` | #4E79D9 | SQL Course |
| `project-red` | #D2584E | Adv Web |
| `project-orange` | #E08A2E | HCI |
| `project-yellow` | #D9B23A | New-project option |
| `project-green` | #4E9F6B | Portfolio |
| `project-teal` | #2E9C93 | New-project option |
| `project-purple` | #8C63D2 | Personal |
| `project-gray` | #8E8A80 | No project |

## Type

Two Google Fonts carry the theme. **Newsreader** (serif) is the brand voice: titles are always semibold 600, and note text is regular 400, used at 19px and up only. **Instrument Sans** (sans) is for everything you operate. Weights are limited to 400, 500 and 600.

- Serif stack: `Newsreader, Georgia, "Times New Roman", serif`
- Sans stack: `"Instrument Sans", -apple-system, "Segoe UI", system-ui, sans-serif`
- Google Fonts: Newsreader (400, 600) and Instrument Sans (400, 500, 600)

| Style | Face | Size / line height | Weight | Use |
| --- | --- | --- | --- | --- |
| `display` | Serif | 36 / 40px | 600 | Screen titles on the four tabs (Inbox, Upcoming, Projects, Notes). |
| `title` | Serif | 28 / 34px | 600 | Sign-in headings, project header, task title in details, note name on the result screen (32/38 there). |
| Dialog / empty-state title | Serif | 24px | 600 | Dialog and empty-state headings. |
| `note` | Serif | 19 / 28px | 400 | What people write in a note, in the editor and when rereading. |
| `heading` | Sans | 17 / 24px | 600 | Section headers (Overdue, Today), sheet and dialog titles, primary button labels. |
| `task-title` | Sans | 16 / 22px | 500 | Task names. Finished tasks drop to 400 with a strike-through in `ink-tertiary`. |
| `body` | Sans | 16 / 22px | 400 | Field values, sheet rows, descriptions. |
| `callout` | Sans | 15 / 21px | 400 | Subtitles, banner and toast text, dialog body, links. |
| `callout-strong` | Sans | 15 / 21px | 600 | Secondary button labels, emphasised links. |
| `footnote` | Sans | 13 / 18px | 400 | Task meta (project · time), helper and error text. |
| `label` | Sans | 13 / 18px | 500 | Field labels, chips, segmented control. |
| `overline` | Sans | 12 / 16px | 600, uppercase, tracking 0.06em | Date above a screen title and group labels (TUESDAY 20 OCTOBER, 3 TASKS MADE). |
| `tab-label` | Sans | 11 / 14px | 500 | Tab bar labels. |

Large serif titles use a slight negative tracking of -0.01em.

## Shape, space and depth

One radius, 12px, covers everything you press or type in. Only overlays float; everything else is flat.

**Radius**

| Token | Value | Use |
| --- | --- | --- |
| `radius-badge` | 6px | Badges and status pills. |
| `radius-tile` | 8px | Icon tiles in property rows, segmented thumb. |
| `radius-mark` | 8px | Logo tile, when one is needed. |
| `radius-segmented` | 10px | Segmented-control track. |
| `radius-field` | 12px | Buttons, text fields, capture bar, banners, toasts. |
| `radius-card` | 16px | The few boxed blocks: summary, note editor, grouped rows in sheets. |
| `radius-dialog` | 20px | Dialogs. |
| `radius-sheet` | 24px | Top corners of bottom sheets. |
| `radius-chip` / `radius-pill` | 999px | Chips, checkboxes, round icon buttons, switches, dots. |

**Spacing** (4px base)

| Token | Value | Use |
| --- | --- | --- |
| `space-2` | 2px | Title to its single meta line in tight rows. |
| `space-4` | 4px | Icon-to-text in meta lines and badges; label to value. |
| `space-6` | 6px | Field label to field; dot to project name. |
| `space-8` | 8px | Between chips, stacked dialog buttons, header icons; under a section header. |
| `space-12` | 12px | Checkbox to task title; icon tile to row label. |
| `space-16` | 16px | Row padding. |
| `space-20` | 20px | Screen side margin; dialog padding; space under a screen title. |
| `space-24` | 24px | Between list sections. |
| `space-32` | 32px | Major blocks on sign-in screens. |

**Shadows** (only on overlays and the capture bar)

| Token | Value | Use |
| --- | --- | --- |
| `shadow-xs` | 0 1px 2px rgba(27,26,23,0.06) | Segmented thumb. |
| `shadow-sm` | 0 2px 10px rgba(27,26,23,0.06) | Floating capture bar. |
| `shadow-knob` | 0 1px 3px rgba(27,26,23,0.2) | Switch knob. |
| `shadow-md` | 0 8px 24px rgba(27,26,23,0.12) | Toasts. |
| `shadow-lg` | 0 16px 48px rgba(27,26,23,0.16) | Sheets, dialogs, menus. |
| `shadow-focus` | 0 0 0 2px `bg`, 0 0 0 4px `accent` | Keyboard focus ring: 2px paper gap, then 2px solid accent. |

**Sizes**

| Token | Value | Use |
| --- | --- | --- |
| `size-control-lg` | 52px | Full-width primary buttons (Sign in, Make tasks). |
| `size-field` | 52px | Text fields, capture bar. |
| `size-control-md` | 44px | Dialog buttons; minimum height of any tappable row. |
| `size-icon-button` | 44px | Round icon buttons (search, account, back, mic). |
| `size-control-sm` | 40px | Inline buttons (Mark done, Undo all). |
| `size-chip` | 32px | Chips, segmented control. |
| `size-icon-tile` | 28px | Coloured icon tiles in settings rows. |
| `size-checkbox` | 22px | Checkbox circle (2px ring) inside a 44px tap area. |
| `size-screen` | 360px | Reference width; fluid from 320px, max 600px column below 768px. |
| `size-sidebar` | 248px | Sidebar from 768px wide. |
| `size-column` | 712px | Content column from 768px wide, with 40px side margins. |
| `size-panel` | 400px | Side panel from 1280px wide. |
| `opacity-disabled` | 0.4 | Whole disabled control at 40%. |

List rows are at least 52px tall.

## Icons and logo

Icons are one line set with rounded caps and joins, 1.5–2px strokes, drawn in `currentColor`. There are 30 icons, from alert-circle to x (the design system's Assets › Icons).

- **Colour:** `ink-secondary` by default, `ink` when the icon is the main thing on a control, `accent` only on the active tab.
- **Size:** 22px in the tab bar, 18–20px in bars and buttons, 15px in tiles, 11–13px in meta lines.
- **Meaning:** `pencil` = notes and capture, `sparkles` = something Agendal did automatically, `flag` = priority (`danger` high, `warning` medium), `paperclip` = a note that came from a file.
- No emoji and no second icon set.

The logo is the team's hand-drawn "A" whose stroke ends in a blue check: the A in `ink`, the check in `accent`. Use `agendal-logo` on light and `agendal-logo-dark` on dark. The wordmark is "Agendal" in Newsreader 600.

## Layout and components

Every screen is built from a small set of patterns:

| Pattern | How it looks |
| --- | --- |
| Tab screen (Inbox, Upcoming, Projects, Notes) | Overline date, then a `display` serif title, then sections: a `heading` section header and hairline-divided rows directly on paper. A floating capture bar ("Write a note…", on `surface` with `shadow-sm`) sits above the tab bar, beside a square + button for adding a task by hand. |
| Tab bar | Translucent `bar` with blur, 4 tabs with 22px icon plus 11px label; the active tab in `accent`, others `ink-secondary`. |
| Task row | 22px round checkbox (ink ring, ink fill when done), `task-title` name, `footnote` meta line: project dot · time · reminder · repeat. Hairline inset to the text. |
| Pushed screen | 44px back button and left-aligned title (NavBar); content below, with the title in the serif. |
| Note editor | Full screen; the note in the serif `note` style on paper; a bottom bar with square mic and paperclip buttons and one full-width blue Make tasks button. |
| Note result | Overline (time · "3 tasks made"), the note's generated name in a 32px serif title, the original note as a quote with a 2px left rule, then a change card for each task with CREATED / UPDATED / DELETED badges; Undo all and Done at the bottom. |
| Notes list | Note cards: overline time, serif name, two-line excerpt, task count or "Waiting for connection". |
| Buttons | Primary: solid `accent`, `on-accent` text, 52px, radius 12, full width at the bottom. Secondary: `fill`. Destructive: `danger-tint` with `danger` text. Only one primary per screen. |
| Fields | `surface`, 1px `control-border`, 52px, radius 12, `label` above, helper or error text in `footnote` below. |
| Chips | 32px pills; unselected `fill`, selected solid `ink` with `bg` text (not blue). |
| Sheets and dialogs | `surface` with `shadow-lg` over `scrim`; sheets have 24px top corners, × to close, accent confirm on the right; dialogs have 20px corners. |
| Banners and toasts | Radius 12; banners use a status tint with a matching icon and title; toasts float with `shadow-md` and carry an Undo action. |

Motion is limited to short fades and slides.

## Interaction and accessibility

The theme is built on standard usability principles:

- **Capture first, organise later.** The capture bar is on every list screen, at the bottom within thumb reach. Writing a note never asks for a date, project or priority.
- **Show system status.** After a note is processed, list every task created, changed or deleted, with badges. Offline notes show "Waiting for connection".
- **Always undoable.** One Undo all reverses a whole note; completing a task shows a toast with Undo; Back always goes back, including the browser's back button.
- **Prevent errors.** Ask before deleting tasks or changing more than five at once. Ask one short question when a note is unclear. Destructive buttons are red and never the default.
- **Recognition over recall.** Rows show project, time and reminder at a glance; notes keep the original text beside what was made from it.
- **Consistency.** One blue full-width primary button per screen, at the bottom. Tab icons always have labels. Back is always top-left.

Accessibility minimums:

- Text 4.5:1 and field borders 3:1 in both themes.
- Focus ring: solid 2px `accent` with a 2px paper gap, on every interactive element.
- Touch targets at least 44px; checkboxes have invisible 44px hit areas.
- Colour never carries meaning alone — always add a word or icon.
- Every icon-only button has an accessible label.

## Content and voice

- **Voice:** calm, brief and kind, like a well-organised friend. Address the person as "you"; Agendal says "I" only when explaining what it did ("I made 3 tasks from your note"). Encouragement stays short: "Nice work!", "2 down, 3 to go!".
- **Casing:** sentence case everywhere; uppercase only for overlines and badges (CREATED).
- **Buttons are verbs** that name the result: Make tasks, Add, Save, Undo all, Keep as note. Safe exits: Cancel, Not now.
- **Confirmations are questions** naming the item, plus one line of consequence: "Delete “Portfolio”?" / "It has 3 tasks. What should happen to them?"
- **Errors say why and what next:** "Email or password is incorrect.", "Attach a file under 5 MB."
- **Dates and times:** 24-hour time by default (16:00 – 17:00; 12-hour is a user setting), short dates (Mon 26 Oct), and Today, Tomorrow, Yesterday as words.
- **Punctuation:** "·" between meta items, curly quotes around task names, a real ellipsis in placeholders ("Write a note…").
- **No emoji** in UI copy.

## Platform: mobile web app (PWA)

- Designed for phones 320–480px wide (360px reference); layouts are fluid, stop at a centred 600px column, and use `100dvh` for full height.
- From 768px wide the same tokens dress a sidebar on `surface` beside the content on `paper`; from 1280px a side panel on `surface` may open on the right ([UX-27](ux-standards.md#ux-27), [UX-28](ux-standards.md#ux-28)).
- Never draw a native status bar, home indicator or keyboard. Pad fixed bottom bars with `env(safe-area-inset-bottom)`.
- Light and dark themes follow the system setting; every token has a value for each.
- After the first sign-in, offer installation once with an info banner.
- Offline, show the warning banner and keep everything editable; notes queue and turn into tasks when the connection returns.

## CSS variables

Paste this to get every token in both themes. Set `data-theme="dark"` on `<html>` to force dark; otherwise the system setting decides.

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap');

:root, [data-theme="light"] {
  --bg: #f6f5f1; --surface: #ffffff; --surface-elevated: #ffffff;
  --fill: #eceae4; --fill-thumb: #ffffff; --separator: #e2dfd7;
  --control-border: #8a867c; --card-edge: #e2dfd7;
  --bar: rgba(246, 245, 241, 0.92); --scrim: rgba(27, 26, 23, 0.32);
  --ink: #1b1a17; --ink-secondary: #57544d; --ink-tertiary: #6b675f;
  --accent: #2f5bd3; --accent-tint: #e8edfb; --on-accent: #ffffff;
  --danger: #b42318; --danger-tint: #fbeae8;
  --success: #2f7a4b; --success-tint: #e6f1ea;
  --warning: #8a5300; --warning-tint: #f6eddc;
  --shadow-focus: 0 0 0 2px #f6f5f1, 0 0 0 4px #2f5bd3;
}

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121211; --surface: #1c1b19; --surface-elevated: #22211e;
  --fill: #262522; --fill-thumb: #3a3935; --separator: #2c2b28;
  --control-border: #77736a; --card-edge: #2c2b28;
  --bar: rgba(18, 18, 17, 0.92); --scrim: rgba(0, 0, 0, 0.6);
  --ink: #f2f0ea; --ink-secondary: #b5b1a7; --ink-tertiary: #9a968c;
  --accent: #8fadff; --accent-tint: #1d2640; --on-accent: #0e1630;
  --danger: #ff8a7f; --danger-tint: #3a1d1a;
  --success: #7dd19c; --success-tint: #16301f;
  --warning: #f0b45a; --warning-tint: #33270f;
  --shadow-focus: 0 0 0 2px #121211, 0 0 0 4px #8fadff;
} }

[data-theme="dark"] {
  --bg: #121211; --surface: #1c1b19; --surface-elevated: #22211e;
  --fill: #262522; --fill-thumb: #3a3935; --separator: #2c2b28;
  --control-border: #77736a; --card-edge: #2c2b28;
  --bar: rgba(18, 18, 17, 0.92); --scrim: rgba(0, 0, 0, 0.6);
  --ink: #f2f0ea; --ink-secondary: #b5b1a7; --ink-tertiary: #9a968c;
  --accent: #8fadff; --accent-tint: #1d2640; --on-accent: #0e1630;
  --danger: #ff8a7f; --danger-tint: #3a1d1a;
  --success: #7dd19c; --success-tint: #16301f;
  --warning: #f0b45a; --warning-tint: #33270f;
  --shadow-focus: 0 0 0 2px #121211, 0 0 0 4px #8fadff;
}

:root {
  /* project colours (both themes) */
  --project-blue: #4e79d9; --project-red: #d2584e; --project-orange: #e08a2e;
  --project-yellow: #d9b23a; --project-green: #4e9f6b; --project-teal: #2e9c93;
  --project-purple: #8c63d2; --project-gray: #8e8a80;
  /* shadows */
  --shadow-xs: 0 1px 2px rgba(27, 26, 23, 0.06);
  --shadow-sm: 0 2px 10px rgba(27, 26, 23, 0.06);
  --shadow-knob: 0 1px 3px rgba(27, 26, 23, 0.2);
  --shadow-md: 0 8px 24px rgba(27, 26, 23, 0.12);
  --shadow-lg: 0 16px 48px rgba(27, 26, 23, 0.16);
  /* space */
  --space-2: 2px; --space-4: 4px; --space-6: 6px; --space-8: 8px; --space-12: 12px;
  --space-16: 16px; --space-20: 20px; --space-24: 24px; --space-32: 32px;
  /* radius */
  --radius-badge: 6px; --radius-tile: 8px; --radius-mark: 8px; --radius-segmented: 10px;
  --radius-field: 12px; --radius-card: 16px; --radius-dialog: 20px; --radius-sheet: 24px;
  --radius-chip: 999px; --radius-pill: 999px;
  /* size */
  --size-control-lg: 52px; --size-field: 52px; --size-control-md: 44px; --size-control-sm: 40px;
  --size-icon-button: 44px; --size-chip: 32px; --size-icon-tile: 28px; --size-checkbox: 22px;
  --size-screen: 360px; --opacity-disabled: 0.4;
  /* fonts */
  --font-sans: "Instrument Sans", -apple-system, "Segoe UI", system-ui, sans-serif;
  --font-serif: Newsreader, Georgia, "Times New Roman", serif;
}

body { background: var(--bg); color: var(--ink); font: 400 16px/22px var(--font-sans); }

.display  { font: 600 36px/40px var(--font-serif); letter-spacing: -0.01em; }
.title    { font: 600 28px/34px var(--font-serif); letter-spacing: -0.01em; }
.note     { font: 400 19px/28px var(--font-serif); }
.heading  { font: 600 17px/24px var(--font-sans); }
.task-title { font: 500 16px/22px var(--font-sans); }
.body     { font: 400 16px/22px var(--font-sans); }
.callout  { font: 400 15px/21px var(--font-sans); }
.callout-strong { font: 600 15px/21px var(--font-sans); }
.footnote { font: 400 13px/18px var(--font-sans); }
.label    { font: 500 13px/18px var(--font-sans); }
.overline { font: 600 12px/16px var(--font-sans); letter-spacing: 0.06em; text-transform: uppercase; }
.tab-label { font: 500 11px/14px var(--font-sans); }
```

## Related

- Product requirements: [product overview](overview.md) and the [module requirements](../03-modules/) — what each screen does and why; this guide covers how it looks

## Sources

- [Agendal design system](https://claude.ai/artifact/1tqQg3Ugsmxm6qJWyXaYpu): tokens, components, icons and logo files
- [Agendal prototype](https://claude.ai/artifact/7uABDQJSswS3pUAeSFNag8): the interactive app in this theme
