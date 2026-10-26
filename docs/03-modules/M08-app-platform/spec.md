# M08 App & Platform — Spec

**Status:** Ready (approved 2026-10-26) · **Requirements:** [prd.md](prd.md) · **Depends on:** [ADR-003](../../07-architecture/technical-decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-004](../../07-architecture/technical-decisions/ADR-004-offline-sync-field-level-lww.md), [ADR-005](../../07-architecture/technical-decisions/ADR-005-sync-protocol.md), [ADR-007](../../07-architecture/technical-decisions/ADR-007-session-and-auth.md), [UX standards](../../01-product/ux-standards.md)

M08 makes Agendal behave like an installed app: install, offline use and sync, themes, back navigation and updates. Decisions marked **(Q20)** extend the PRD.

## 1. Entry points and user stories

- As a student, I install Agendal on my home screen and open it like any app.
- As a student on a flaky campus network, I keep working and nothing is lost.
- As a student with two devices, I see on my laptop what I did on my phone.
- As a student, the app follows my phone's dark mode, and I can override it.
- As a student, Back always takes me where I expect, including the phone's back gesture.

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
- **API responses** are never put in the HTTP cache (NF-19). Data lives in IndexedDB.
- **What the device keeps:**
  - All open tasks
  - Tasks completed in the last 90 days
  - All projects
  - The last 100 notes
  - The edit queue, pending notes and the draft
- **Detecting offline:** `navigator.onLine`, plus any failed fetch, because `onLine` can claim a connection that isn't there. The banner `app.offline` shows within 2 s (UX-40). An online event or a successful fetch hides it.
- **Sync (ADR-005):**
  - Runs on open, on reconnect, when the app becomes visible, and every 60 s while visible.
  - Order: push patches → pending notes, oldest first → pull.
  - It runs inside `navigator.locks.request('sync')`, so only one tab syncs. Other tabs get the updates through a `BroadcastChannel`.
- **Retry:** on network failure, backoff of 1 s, 5 s, 30 s, then 60 s, with ±20% jitter.
- **Conflicts (Q20):** when a pull overwrites a field the device had changed locally (an LWW loss):
  - The toast `app.conflict` shows.
  - The row shows a "Changed on another device" marker until the task is opened.
  - Only the latest such toast shows.
- **Storage:**
  - After the first note or first install, the app asks `navigator.storage.persist()`.
  - If `storage.estimate()` shows under 10 MB free, the banner `app.storage_low` shows.
- **Full resync:** on `410` (ADR-005), the device downloads the full data again after pushing its queue first. Nothing local is dropped.

### 2.3 Themes (AP-3)

- **Setting (Q20):** Account → Appearance: System / Light / Dark. That's a three-way choice, because a toggle can't return to "System".
  - Default: System.
  - The choice is stored on the user (`theme`) and in local storage, so every device follows it.
- **No flash on load:** a tiny blocking `theme.js` in `<head>` sets `data-theme` before first paint. It's an external file, because CSP forbids inline scripts (NF-16).
- **Browser chrome:** `<meta name="theme-color">` is updated with the theme.

### 2.4 Back navigation (AP-4)

- **Every screen has a URL:** `/inbox`, `/upcoming`, `/projects`, `/projects/{id}`, `/notes`, `/notes/{id}`, `/tasks/{id}`, `/search`, `/note/new`.
- **Sheets and dialogs** push a history entry, so Back (in-app, browser, or the Android gesture) closes them first.
- **After Make tasks:** the editor's history entry is **replaced** by the result. Back from the result goes to where the editor was opened (M04 E12).
- **Deep links:** when the first page is a deep link, the in-app back goes to that tab's root, not out of the app.
- **Tab switches** replace the history entry, so Back doesn't walk through every tab visited.
- **Scroll position** is restored when going back to a list.

### 2.5 Updates and errors

- **New version:** UX-42 (`app.update_ready` with Reload, never automatic while editing).
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
| E1 | iOS: no `beforeinstallprompt` | Manual guidance banner (§2.1) | T-AP-101 |
| E2 | Safari deletes storage after 7 days without use (non-installed sites) | Accepted for non-installed use. The install banner explains that installing keeps data offline. Any queue syncs as soon as the app opens online, so loss needs 7 days offline *and* unused | T-AP-102 (documented), OFF-10 |
| E3 | Two tabs open | Only one syncs (Web Locks). The other updates through `BroadcastChannel` | T-AP-103, OFF-11 |
| E4 | `navigator.onLine` is true, but the network is dead (captive portal) | A failed fetch shows the banner. Edits queue as when offline | T-AP-104, OFF-12 |
| E5 | A new version is deployed while a sheet is open | The toast waits. No reload until the student chooses, or the next cold start | T-AP-105 |
| E6 | 100 queued edits and 10 pending notes on reconnect | Done within 10 s, in order, no loss (PERF-04) | OFF-13, PERF-04 |
| E7 | Same field edited on two devices | Later `at` wins (ADR-004). The losing device shows `app.conflict` | OFF-14 |
| E8 | Device offline longer than the tombstone window (30 days) | `410` → push the queue, then a full resync | OFF-15 |
| E9 | Back gesture while a dialog is open | Closes the dialog, stays on the screen | T-AP-106 |
| E10 | The theme is changed on one device | The other device picks it up on its next pull | T-AP-107 |
| E11 | The service worker fails to install (private mode, storage blocked) | The app still works online. The offline banner wording warns that offline isn't available (`app.no_offline`) | T-AP-108 |
| E12 | The storage quota is exceeded during sync | Stop caching old completed tasks first. The queue and pending notes are never evicted | T-AP-109 |

## 5. Copy keys

`app.install_title`, `app.install`, `app.install_ios`, `app.install_firefox`, `common.not_now`, `app.offline`, `app.offline_body`, `app.no_offline`, `app.conflict`, `app.storage_low`, `app.update_ready`, `app.reload`, `app.dark_mode`, `app.appearance`, `app.last_synced`, `error.generic`.

## 6. Accessibility

- Banners are `role="status"` (offline, install) and don't steal focus. A11Y-70
- The Appearance setting is a radio group. Both themes meet NF-1 contrast, checked by axe in each theme. A11Y-71
- Route changes move focus to the new screen's `h1` and update `document.title` ("Inbox · Agendal"). A11Y-72
- Reduced motion is respected (UX-51). A11Y-73

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /sync?cursor=&limit=500` | — | `200 {changes: {tasks[], projects[], notes[]}, next_cursor, has_more}` (tombstones have `deleted_at`) | `410` cursor too old, `401`, `429` (30/min) |
| `POST /sync/patches` | `[{entity, id, field, value, at}]`, up to 500 per batch | `200 {results: [{index, status: applied\|stale\|rejected, current?}]}`. `stale` returns the server's current value, for the conflict notice | `401`, `422` (batch shape), `429` |
| `PATCH /me` | `{theme}` | `200` | `422` |

- Patch rows are judged one by one. A rejected row (not the user's, a field not on the allow-list) never fails the batch.

## 8. Data, validation and authorization

- **Patches:**
  - `entity` ∈ {task, project}. The field allow-lists are in M05 §8 and M07 §8.
  - `at` is clamped to server time + 5 min (SC-17).
  - Creates go through the same endpoint, with a client UUID and every field.
- **IndexedDB:** keyed by user ID. Wiped on sign-out, and before a different user's data loads (M01 E7).
- **Service worker:** never caches `/api/*`, and serves the API only with `Cache-Control: no-store` responses (SEC-51).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Patching another user's rows | SC-10, rejected per row | SEC-12 |
| Patching system fields | Field allow-list | SEC-15 |
| Future timestamps to always win | SC-17 clamp | SEC-14 |
| Data read from the device after sign-out | SC-19 wipe | SEC-50 |
| A huge patch batch | 500 rows max, 30/min | SEC-10, SEC-11 |

## 10. Performance and scaling

- NF-4: interactive in ≤ 3 s on first load (4G, mid-range phone), ≤ 1 s from cache. Checked by Lighthouse CI.
- App shell budget: ≤ 170 KB JS gzipped for the first route. Fonts are subset and preloaded.
- Sync pull uses `(user_id, change_seq)`. A no-change pull is about 1 ms on the database. 60-second polling × 5k users ≈ 15 req/s peak, which is inside PERF-01.

## 11. Analytics

| Event | Properties | Feeds |
|---|---|---|
| `app_installed` | entry (banner, account) | Install rate |
| `session_started` | online, installed | Weekly retention |
| `sync_completed` | patches, notes, pulled, conflicts, ms | Sync health |
| `sync_failed` | status | Sync health |

## 12. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| AP-1 | After the first sign-in, an Install banner shows once (Install / Not now) | T-AP-01 (Chromium), T-AP-101 (iOS guidance), T-AP-02 (not shown again) |
| AP-1 | Install app stays available in Account | T-AP-03 |
| AP-2 | Every edit is saved on the device and syncs later | OFF-01–04 (M02), OFF-10–15, OFF-20–21 (M05), PERF-04 |
| AP-2 | "You're offline" banner on list screens | T-AP-10 (within 2 s), T-AP-104 |
| AP-3 | Follows the system setting. Dark mode can be switched in Account | T-AP-20 (`prefers-color-scheme` emulation), T-AP-21 (three-way setting synced), T-AP-22 (no flash) |
| AP-4 | The in-app back button and the browser's Back both return to the previous screen | T-AP-30 (every route pair), T-AP-106, M04 E12 |
| — | A `500` shows `error.generic` with a request ID, and no stack trace (ASVS 7.4.1) | T-AP-40 |
| — | The retention purge job removes tombstones and expired data on schedule | T-AP-41 |
| — | Edge cases E1–E12 | T-AP-101–109, OFF-10–15 |
| — | Accessibility | A11Y-70–73 |
