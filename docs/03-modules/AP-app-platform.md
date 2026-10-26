# AP — App & Platform

Behaving like an installed app: install prompt, full offline use, light and dark themes, date and time formats, and back navigation that matches the browser.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-003](../07-architecture/decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md), [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md), [ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md), [UX standards](../01-product/ux-standards.md)

- **Screens:** Install and offline banners, Account sheet ([screens and navigation](../01-product/screens.md))
- **Workflows:** [WF-05](../04-workflows/WF-05-offline-capture-and-sync.md)

AP makes Agendal behave like an installed app: install, offline use and sync, themes, back navigation and updates. Decisions marked **([Q20](../08-project/open-questions.md#q20))** extend the PRD.

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="ap-1"></a>AP-1 | Install as an app | Must | After the first sign-in, an Install banner shows once (Install / Not now); Install app stays available in Account |
| <a id="ap-2"></a>AP-2 | Work offline | Must | Every edit is saved on the device and syncs later; a "You're offline" banner shows on list screens |
| <a id="ap-3"></a>AP-3 | Light and dark themes | Must | Follows the system setting; Dark mode can be switched in Account |
| <a id="ap-4"></a>AP-4 | Consistent back navigation | Must | The in-app back button and the browser's Back both return to the previous screen |
| <a id="ap-5"></a>AP-5 | Choose week start and time format ([Q6](../08-project/open-questions.md#q6)) | Must | Account has Week starts on (Monday / Sunday) and Time format (24-hour / 12-hour); every date picker, list and note phrase such as "next week" follows them |

## 1. Entry points and user stories

- As a user, I install Agendal on my home screen and open it like any app.
- As a user on a flaky network, I keep working and nothing is lost.
- As a user with two devices, I see on my laptop what I did on my phone.
- As a user, the app follows my phone's dark mode, and I can override it.
- As a user, Back always takes me where I expect, including the phone's back gesture.

## 2. Behaviour detail

### 2.1 Install (AP-1)

- **Banner:** shown once per device, after the first sign-in on that device. It isn't shown when already installed (`display-mode: standalone`). Not now hides it for good on that device.
- **By platform:**

| Platform | Banner | Install |
|---|---|---|
| Chromium (Android, desktop), Samsung Internet | `app.install_title` with Install / Not now | Uses the saved `beforeinstallprompt` event |
| iOS Safari | `app.install_ios` (Share → Add to Home Screen), with a share icon | Manual |
| Firefox Android | Same as iOS, worded for its menu (`app.install_firefox`) | Manual |
| Unsupported (Firefox desktop) | None | Account "Install app" hidden |

- **Account sheet:** "Install app" is shown whenever the app isn't installed and install is possible.
- **Event:** `app_installed` is sent on `appinstalled`, or the first time the app runs in standalone mode.

### 2.2 Offline and sync (AP-2, NF-6)

- **App shell:** the service worker precaches hashed assets, so the app opens offline. Navigations try the network first and fall back to the cached shell.
- **API responses** are never put in the HTTP cache ([NF-19](../05-quality/nfr.md#nf-19)). Data lives in IndexedDB.
- **What the device keeps:**
  - All open tasks
  - Tasks completed in the last 90 days
  - All projects
  - The last 100 notes
  - The edit queue, pending notes and the draft
- **Detecting offline:** `navigator.onLine`, plus any failed fetch, because `onLine` can claim a connection that isn't there. The banner `app.offline` shows within 2 s ([UX-40](../01-product/ux-standards.md#ux-40)). An online event or a successful fetch hides it.
- **Sync ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)):**
  - Runs on open, on reconnect, when the app becomes visible, and every 60 s while visible.
  - Order: push patches → pending notes, oldest first → pull.
  - It runs inside `navigator.locks.request('sync')`, so only one tab syncs. Other tabs get the updates through a `BroadcastChannel`.
- **Retry:** on network failure, backoff of 1 s, 5 s, 30 s, then 60 s, with ±20% jitter.
- **Conflicts ([Q20](../08-project/open-questions.md#q20)):** when a pull overwrites a field the device had changed locally (an LWW loss):
  - The toast `app.conflict` shows.
  - The row shows a "Changed on another device" marker until the task is opened.
  - Only the latest such toast shows.
- **Storage:**
  - After the first note or first install, the app asks `navigator.storage.persist()`.
  - If `storage.estimate()` shows under 10 MB free, the banner `app.storage_low` shows.
- **Full resync:** on `410` ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)), the device downloads the full data again after pushing its queue first. Nothing local is dropped.

### 2.3 Themes and formats (AP-3, AP-5)

- **Setting ([Q20](../08-project/open-questions.md#q20)):** Account → Appearance: System / Light / Dark. That's a three-way choice, because a toggle can't return to "System".
  - Default: System.
  - The choice is stored on the user (`theme`) and in local storage, so every device follows it.
- **No flash on load:** a tiny blocking `theme.js` in `<head>` sets `data-theme` before first paint. It's an external file, because CSP forbids inline scripts ([NF-16](../05-quality/nfr.md#nf-16)).
- **Browser chrome:** `<meta name="theme-color">` is updated with the theme.

**Week start and time format ([AP-5](#ap-5)):**

- **Settings:** Account → Week starts on: Monday / Sunday (default Monday). Time format: 24-hour / 12-hour (default 24-hour, [NF-12](../05-quality/nfr.md#nf-12)).
- **Stored** on the user (`week_start`, `time_format`), so every device follows them after the next pull, like the theme.
- **Week start** sets the first column of date pickers, the meaning of *next week* and *end of the week* in notes ([NU-E10](NU-note-understanding.md#nu-e10)), and where Upcoming's weeks begin.
- **Time format** changes display only ([UX-32](../01-product/ux-standards.md#ux-32)): `16:00` or `4:00 pm`. Notes accept both ways of writing a time, whatever the setting.

### 2.4 Back navigation (AP-4)

- **Every screen has a URL:** `/inbox`, `/upcoming`, `/projects`, `/projects/{id}`, `/notes`, `/notes/{id}`, `/tasks/{id}`, `/search`, `/note/new`.
- **Sheets and dialogs** push a history entry, so Back (in-app, browser, or the Android gesture) closes them first.
- **After Make tasks:** the editor's history entry is **replaced** by the result. Back from the result goes to where the editor was opened ([RV-E12](RV-review-control.md#rv-e12)).
- **Deep links:** when the first page is a deep link, the in-app back goes to that tab's root, not out of the app.
- **Tab switches** replace the history entry, so Back doesn't walk through every tab visited.
- **Scroll position** is restored when going back to a list.

### 2.5 Updates and errors

- **New version:** [UX-42](../01-product/ux-standards.md#ux-42) (`app.update_ready` with Reload, never automatic while editing).
- **Crashes:** an error boundary shows `error.generic` with Reload. The error is reported to monitoring without user data.

## 3. State matrix

| Component | Hidden | Shown | Action | Error | Offline |
|---|---|---|---|---|---|
| Install banner | Installed, dismissed, unsupported, or not the first sign-in | Per platform (§2.1) | Install → native prompt. Accepted → hidden | Prompt dismissed → kept for next time (not counted as Not now) | Shown (install works offline on Chromium) |
| Offline banner | Online | `app.offline` and `app.offline_body` | — | — | — |
| Sync | Idle | Silent | — | Backoff. After 3 failures, a quiet "Last synced 08:12" in the Account sheet | Paused |
| Update toast | No waiting service worker | `app.update_ready` | Reload → `skipWaiting`, then reload | — | Shown |
| Storage banner | ≥ 10 MB free | `app.storage_low` | — | — | Shown |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| <a id="ap-e1"></a>AP-E1 | iOS: no `beforeinstallprompt` | Manual guidance banner (§2.1) | T-AP-101 |
| <a id="ap-e2"></a>AP-E2 | Safari deletes storage after 7 days without use (non-installed sites) | Accepted for non-installed use. The install banner explains that installing keeps data offline. Any queue syncs as soon as the app opens online, so loss needs 7 days offline *and* unused | T-AP-102 (documented), OFF-10 |
| <a id="ap-e3"></a>AP-E3 | Two tabs open | Only one syncs (Web Locks). The other updates through `BroadcastChannel` | T-AP-103, OFF-11 |
| <a id="ap-e4"></a>AP-E4 | `navigator.onLine` is true, but the network is dead (captive portal) | A failed fetch shows the banner. Edits queue as when offline | T-AP-104, OFF-12 |
| <a id="ap-e5"></a>AP-E5 | A new version is deployed while a sheet is open | The toast waits. No reload until the user chooses, or the next cold start | T-AP-105 |
| <a id="ap-e6"></a>AP-E6 | 100 queued edits and 10 pending notes on reconnect | Done within 10 s, in order, no loss (PERF-04) | OFF-13, PERF-04 |
| <a id="ap-e7"></a>AP-E7 | Same field edited on two devices | Later `at` wins ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)). The losing device shows `app.conflict` | OFF-14 |
| <a id="ap-e8"></a>AP-E8 | Device offline longer than the tombstone window (30 days) | `410` → push the queue, then a full resync | OFF-15 |
| <a id="ap-e9"></a>AP-E9 | Back gesture while a dialog is open | Closes the dialog, stays on the screen | T-AP-106 |
| <a id="ap-e10"></a>AP-E10 | The theme is changed on one device | The other device picks it up on its next pull | T-AP-107 |
| <a id="ap-e11"></a>AP-E11 | The service worker fails to install (private mode, storage blocked) | The app still works online. The offline banner wording warns that offline isn't available (`app.no_offline`) | T-AP-108 |
| <a id="ap-e12"></a>AP-E12 | The storage quota is exceeded during sync | Stop caching old completed tasks first. The queue and pending notes are never evicted | T-AP-109 |
| <a id="ap-e13"></a>AP-E13 | Week start changed while a note is pending offline | The note uses the setting at processing time, because the server applies it. The result screen shows the dates it chose | T-AP-110 |

## 5. Copy keys

`app.install_title`, `app.install`, `app.install_ios`, `app.install_firefox`, `common.not_now`, `app.offline`, `app.offline_body`, `app.no_offline`, `app.conflict`, `app.storage_low`, `app.week_start`, `app.time_format`, `app.update_ready`, `app.reload`, `app.dark_mode`, `app.appearance`, `app.last_synced`, `error.generic`.

## 6. Accessibility

- Banners are `role="status"` (offline, install) and don't steal focus. A11Y-70
- The Appearance setting is a radio group. Both themes meet [NF-1](../05-quality/nfr.md#nf-1) contrast, checked by axe in each theme. A11Y-71
- Route changes move focus to the new screen's `h1` and update `document.title` ("Inbox · Agendal"). A11Y-72
- Reduced motion is respected ([UX-51](../01-product/ux-standards.md#ux-51)). A11Y-73

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /sync?cursor=&limit=500` | — | `200 {changes: {tasks[], projects[], notes[]}, next_cursor, has_more}` (tombstones have `deleted_at`) | `410` cursor too old, `401`, `429` (30/min) |
| `POST /sync/patches` | `[{entity, id, field, value, at}]`, up to 500 per batch | `200 {results: [{index, status: applied\|stale\|rejected, current?}]}`. `stale` returns the server's current value, for the conflict notice | `401`, `422` (batch shape), `429` |
| `PATCH /me` | `{theme?, week_start?, time_format?}` | `200` | `422` |

- Patch rows are judged one by one. A rejected row (not the user's, a field not on the allow-list) never fails the batch.

## 8. Data, validation and authorization

- **Patches:**
  - `entity` ∈ {task, project}. The field allow-lists are in [TK §8](TK-tasks.md#8-data-validation-and-authorization) and [PJ §8](PJ-projects.md#8-data-validation-and-authorization).
  - `at` is clamped to server time + 5 min ([SC-17](../07-architecture/security.md#sc-17)).
  - Creates go through the same endpoint, with a client UUID and every field.
- **IndexedDB:** keyed by user ID. Wiped on sign-out, and before a different user's data loads ([AA-E7](AA-account-access.md#aa-e7)).
- **Service worker:** never caches `/api/*`, and serves the API only with `Cache-Control: no-store` responses (SEC-51).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Patching another user's rows | [SC-10](../07-architecture/security.md#sc-10), rejected per row | SEC-12 |
| Patching system fields | Field allow-list | SEC-15 |
| Future timestamps to always win | [SC-17](../07-architecture/security.md#sc-17) clamp | SEC-14 |
| Data read from the device after sign-out | [SC-19](../07-architecture/security.md#sc-19) wipe | SEC-50 |
| A huge patch batch | 500 rows max, 30/min | SEC-10, SEC-11 |

## 10. Performance and scaling

- [NF-4](../05-quality/nfr.md#nf-4): interactive in ≤ 3 s on first load (4G, mid-range phone), ≤ 1 s from cache. Checked by Lighthouse CI.
- App shell budget: ≤ 170 KB JS gzipped for the first route. Fonts are subset and preloaded.
- Sync pull uses `(user_id, change_seq)`. A no-change pull is about 1 ms on the database. 60-second polling × 5k users ≈ 15 req/s peak, which is inside PERF-01.

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [AP-1](#ap-1) | After the first sign-in, an Install banner shows once (Install / Not now) | T-AP-01 (Chromium), T-AP-101 (iOS guidance), T-AP-02 (not shown again) |
| [AP-1](#ap-1) | Install app stays available in Account | T-AP-03 |
| [AP-2](#ap-2) | Every edit is saved on the device and syncs later | OFF-01–04 (NC), OFF-10–15, OFF-20–21 (TK), PERF-04 |
| [AP-2](#ap-2) | "You're offline" banner on list screens | T-AP-10 (within 2 s), T-AP-104 |
| [AP-3](#ap-3) | Follows the system setting. Dark mode can be switched in Account | T-AP-20 (`prefers-color-scheme` emulation), T-AP-21 (three-way setting synced), T-AP-22 (no flash) |
| [AP-4](#ap-4) | The in-app back button and the browser's Back both return to the previous screen | T-AP-30 (every route pair), T-AP-106, [RV-E12](RV-review-control.md#rv-e12) |
| — | A `500` shows `error.generic` with a request ID, and no stack trace (ASVS 7.4.1) | T-AP-40 |
| — | The retention purge job removes tombstones and expired data on schedule | T-AP-41 |
| [AP-5](#ap-5) | Week start and time format are settings that every picker, list and note phrase follows | T-AP-50 (setting synced), T-AP-51 (picker and Upcoming week start), T-AP-52 (12-hour display), T-NU-110 ("next week") |
| — | Edge cases [AP-E1](#ap-e1)–[AP-E13](#ap-e13) | T-AP-101–110, OFF-10–15 |
| — | Accessibility | A11Y-70–73 |
