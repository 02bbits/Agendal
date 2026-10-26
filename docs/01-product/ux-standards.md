# UX Standards

Interaction rules that apply to every screen. Specs reference these instead of repeating them. Visuals and voice: [theme guide](theme-guide.md). Strings: [copy catalog](copy-catalog.md).

## 1. Feedback and timing

| ID | Rule |
|---|---|
| <a id="ux-01"></a>UX-01 | **Optimistic UI** for task actions (complete, edit, delete, reorder fields). The change shows at once and syncs in the background. If the server rejects it, revert the row and show `error.save_failed` with Retry. |
| <a id="ux-02"></a>UX-02 | **Notes are not optimistic.** After Make tasks, the editor shows "Reading your note…" (`note.reading`) until the result arrives. The result screen opens only with the real plan. |
| <a id="ux-03"></a>UX-03 | **Loading thresholds:** nothing for the first 300 ms. Then a skeleton in the shape of the content (never a full-screen spinner). After 10 s, add `error.slow` with Retry. |
| <a id="ux-04"></a>UX-04 | **Toasts** show for 5 s. Hovering, focusing or touching the toast pauses the timer, which restarts when focus leaves (WCAG 2.2.1). One toast at a time: a new one replaces the old one, and the replaced toast's Undo stays available from the row it changed. |
| <a id="ux-05"></a>UX-05 | **Undo in toasts** reverses exactly the action named. It works offline (it is a local edit like any other). |
| <a id="ux-06"></a>UX-06 | **Double submit** is impossible: a primary button turns busy (spinner inside, label kept for screen readers) and ignores taps until the request ends. Note and task creation also carry a client ID, so a retry can't duplicate ([ADR-003](../07-architecture/decisions/ADR-003-offline-note-queue-and-idempotency.md)). |
| <a id="ux-07"></a>UX-07 | **Errors stay until fixed or dismissed.** Field errors show under the field on blur and on submit, never while typing the first time. The first invalid field gets focus on submit. |

## 2. Focus and keyboard

| ID | Rule |
|---|---|
| <a id="ux-10"></a>UX-10 | Opening a sheet or dialog moves focus to its first field, or to its title if it has no field. Focus is trapped inside. Escape closes it (unless it has unsaved input, then [UX-13](#ux-13)). |
| <a id="ux-11"></a>UX-11 | Closing a sheet, dialog or pushed screen returns focus to the control that opened it. If that control is gone (the task was deleted), focus goes to the list heading. |
| <a id="ux-12"></a>UX-12 | **Shortcuts:** Ctrl/Cmd+Enter submits the note editor and every sheet. Enter in a single-line field submits the form. `/` focuses Search on list screens when no field has focus. |
| <a id="ux-13"></a>UX-13 | **Unsaved input:** closing the note editor with text saves a draft on the device (restored next time it opens). Closing a sheet with changes asks "Discard changes?" (`common.discard`). |
| <a id="ux-14"></a>UX-14 | Tab order follows the visual order. Every control has a visible 2px focus ring ([NF-2](../05-quality/nfr.md#nf-2)). |

## 3. Mobile viewport

| ID | Rule |
|---|---|
| <a id="ux-20"></a>UX-20 | Fixed bottom bars (capture bar, primary buttons) sit above the on-screen keyboard, using `visualViewport` to measure it, and above `env(safe-area-inset-bottom)`. |
| <a id="ux-21"></a>UX-21 | A focused field is scrolled into view above the keyboard. Inputs use 16px text or larger, so iOS doesn't zoom. |
| <a id="ux-22"></a>UX-22 | Inputs set `inputmode`, `autocomplete` and `enterkeyhint` (email, current-password, new-password, search, done). |
| <a id="ux-23"></a>UX-23 | No horizontal scroll from 320px wide. Long words in titles wrap (`overflow-wrap: anywhere`). |

## 4. Truncation and formatting

| ID | Rule |
|---|---|
| <a id="ux-30"></a>UX-30 | Task titles in rows: up to 2 lines, then an ellipsis. Full title in Task details and in the accessible name. |
| <a id="ux-31"></a>UX-31 | Note excerpts on Notes cards: 2 lines. Note names: 34 characters, cut at a word boundary (business rules). |
| <a id="ux-32"></a>UX-32 | Dates: Today, Tomorrow, Yesterday as words. Otherwise `Mon 26 Oct`, with the year only when it isn't the current year. Times: 24-hour `16:00` by default, or 12-hour `4:00 pm` when the user picks it ([AP-5](../03-modules/AP-app-platform.md#ap-5)). Ranges `16:00 – 17:00` ([NF-12](../05-quality/nfr.md#nf-12)). |
| <a id="ux-33"></a>UX-33 | Counts use the singular for 1: "1 task", "2 tasks". The copy catalog has `_one` / `_other` forms for every count. |

## 5. Connectivity and updates

| ID | Rule |
|---|---|
| <a id="ux-40"></a>UX-40 | Going offline shows the "You're offline" banner on list screens within 2 s. Nothing becomes read-only. Coming back hides it, and queued work syncs without a prompt. |
| <a id="ux-41"></a>UX-41 | A sync conflict or a failed replay is never silent. It shows a toast, and the affected row shows a small notice until opened (AP module). |
| <a id="ux-42"></a>UX-42 | **New version:** when a new service worker is waiting, show "A new version is ready." with Reload (`app.update_ready`). Never reload by itself while a field has input or a sheet is open. Reload anyway on the next cold start. |
| <a id="ux-43"></a>UX-43 | Rate limited (`429`): show `error.rate_limited`. Keep the user's input, and enable the button again after `Retry-After`. |
| <a id="ux-44"></a>UX-44 | Session expired (`401` on a signed-in screen): keep unsynced changes on the device, open Sign in with `auth.session_expired`, and return to the same screen afterwards. |

## 6. Motion

| ID | Rule |
|---|---|
| <a id="ux-50"></a>UX-50 | Fades and slides only, 150–200 ms, `ease-out` in and `ease-in` out. Sheets slide up, pushed screens slide from the right. |
| <a id="ux-51"></a>UX-51 | `prefers-reduced-motion: reduce` turns slides into fades of 100 ms or less, and turns off progress-bar animation. |
| <a id="ux-52"></a>UX-52 | Nothing moves on its own except "Listening…" and loading skeletons, and both stop under reduced motion. |

## 7. Announcements (NF-3)

| ID | Rule |
|---|---|
| <a id="ux-60"></a>UX-60 | Toasts, "Listening…", "Reading file…", "Reading your note…" and the offline banner are in a polite live region. Errors that block an action use an assertive one. |
| <a id="ux-61"></a>UX-61 | After a note is processed, the result screen heading gets focus and reads its overline (for example "3 tasks made"). |
| <a id="ux-62"></a>UX-62 | Completing a task announces the new progress ("2 of 5 done"). |
