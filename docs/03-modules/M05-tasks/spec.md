# M05 Tasks — Spec

**Status:** Ready (approved 2026-10-26) · **Requirements:** [prd.md](prd.md) · **Depends on:** [ADR-004](../../07-architecture/technical-decisions/ADR-004-offline-sync-field-level-lww.md), [ADR-005](../../07-architecture/technical-decisions/ADR-005-sync-protocol.md), [ADR-006](../../07-architecture/technical-decisions/ADR-006-time-zones.md), [business rules](../../02-domain/business-rules.md#other-rules)

M05 covers one task: completing it, editing every field, repeats, deleting, and reminders. Decisions marked **(Q20)** extend the PRD.

## 1. Entry points and user stories

| Entry | Opens |
|---|---|
| Checkbox on any task row | Completes in place |
| Task row, a result row, a reminder notification | Task details |

- As a student, I tick a task and see my progress move, so that finishing feels good.
- As a student, I fix a date the assistant got wrong in two taps.
- As a student with a weekly lab, I complete it and next week's appears by itself.
- As a student, I get a nudge before a quiz, even with the app closed.

## 2. Behaviour detail

### 2.1 Complete (TK-1)

- **Ticking:**
  - The tick is optimistic (UX-01). The row strikes through, then moves to its list's completed area after 600 ms, so it doesn't jump out from under the student's thumb.
  - The progress line updates, and its new value is announced (UX-62).
  - The toast `task.completed` offers Undo.
- **Unticking** a completed task (in Completed, Search or details) reopens it. That doesn't show a toast.
- **Repeating task:** completing it creates the next occurrence (§2.3). Undo from the toast reopens the task and deletes that occurrence.

### 2.2 Task details and editing (TK-2, TK-3)

- **Saving:** every field saves on change, or on blur for text. There is no Save button. Each save is a per-field patch (ADR-004).
- **Title:** 1–200 characters. Cleared and blurred → it goes back to the previous value with `task.title_required`.
- **Schedule:**
  - Start and end are times on the due date (data model). Setting a start with no due date sets the due date to today.
  - End is disabled until a start exists. Clearing the start clears the end.
  - An end not after the start shows `task.end_before_start` and isn't saved (TK-3, DB `CHECK`).
- **Due date:** native date input with Clear. Clearing the date also clears the start, end and reminder, after a toast with Undo, because those fields depend on the date.
- **Reminder:**
  - Options: None, 5, 15 or 30 minutes, 1 hour, 1 day before.
  - Disabled with `task.reminder_needs_date` when there is no due date.
  - With a start time, the offset counts from the start. Without one, it counts from 09:00 on the due date (BR-12).
  - A reminder time already passed shows `task.reminder_past`. It is still saved, and no notification is sent.
- **Repeat:** Never, Daily, Weekly, Monthly, Yearly. Choosing a repeat when there's no due date sets the due date to today.
- **Priority:** Low, Medium, High. **Project:** picker with No project, the user's projects and New project…. **Notes:** up to 5,000 characters, the box grows with the text.
- **Assistant tasks:** an assistant-made task shows `task.created_by_assistant` with the link `task.from_note` ("From note: {name}"), which opens the note's result (NU-7).
- **Footer:** "Created Mon 26 Oct · Edited Today 08:15" in footnote style.

### 2.3 Repeating tasks (TK-4)

- **Next occurrence (Q20):**
  - It comes from the **due date**, not the completion date.
  - It is the first date in the series **after the current due date and on or after today**. Missed occurrences are skipped, so they never pile up as overdue.
- **Anchor:** each series keeps `repeat_anchor`, its first due date.
  - Monthly uses the anchor's day, capped at the month's last day: 31 Jan → 28 Feb → 31 Mar.
  - Yearly on 29 Feb → 28 Feb in non-leap years.
- **What the next occurrence copies:** title, project, priority, start and end times, reminder offset, repeat, notes, anchor and `created_by`. It sets `previous_occurrence_id` (used by M04 undo).
- **Delete** asks `task.repeat_scope_title`:
  - **This task only:** deletes this occurrence and creates the next one, so the series continues.
  - **This and all future:** deletes this occurrence. No future ones exist yet, so the series ends.
  - Past completed occurrences are never touched.
- **Edit scope:** an edit applies to this occurrence and is carried into every later one, because each copies the previous one. There is no "edit all" dialog, since only one open occurrence ever exists.
- **No repeat end date:** the PRD has none (Later).

### 2.4 Delete (TK-5)

- **Confirm first:** `task.delete_title`, with a red Delete and Cancel. A repeating task gets the scope dialog instead (§2.3).
- **After deleting:** a soft delete (`deleted_at`, ADR-005), then the toast `task.deleted` with Undo.
- **Deleted from details:** the screen goes back, and focus follows UX-11.

### 2.5 Reminders (TK-6, Should)

- **Permission in context:**
  - The first time a reminder is set, by hand or by a note, an in-app explainer shows: `task.push_explainer` with Allow / Not now.
  - Allow triggers the browser's permission prompt. It is never asked at sign-in.
  - Not now is remembered for 14 days.
- **iOS:** push works only in the installed app (iOS 16.4+). In Safari, the explainer becomes `app.install_for_reminders`.
- **Scheduler (ADR-006):**
  - Runs every minute. It claims due `remind_at` rows with `FOR UPDATE SKIP LOCKED`.
  - Writes `reminder_deliveries (task_id, remind_at)` (unique) before sending, so a reminder is never sent twice.
  - Sends to every subscription the user has.
  - Skips done or deleted tasks, and reminders more than 10 minutes late (after downtime, a burst of stale reminders helps nobody).
- **Notification:** the title is the task title. The body is `Mon 09:00 · SQL Course`. Tapping it opens Task details.
- **Dead subscriptions:** a push service answering `404`/`410` deletes that subscription.
- **Recomputing `remind_at`:** whenever the due date, start time, reminder or the user's time zone changes, and for each new occurrence.

## 3. State matrix

| Component | Empty | Loading | Success | Error | Offline | Permission denied |
|---|---|---|---|---|---|---|
| Task row checkbox | — | — | Struck through, toast | Revert and `error.save_failed` with Retry | Works, queued | — |
| Task details | — | Skeleton after 300 ms (deep link) | Fields | `404` → `error.not_found` with Back. Field error inline | Works. Edits queued. Assistant link to the note works from cache | — |
| Delete dialog | — | Busy button | Back, toast | `error.save_failed` | Works, queued | — |
| Reminder field | Disabled without a date | — | Saved | `task.reminder_past` (helper, not an error) | Works. `remind_at` is computed on sync | Push denied: helper `task.push_denied`, with a link to how to turn it back on |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| E1 | Monthly repeat on the 31st | Anchor day capped per month (§2.3) | T-TK-101 |
| E2 | Completing an overdue daily task 3 days late | The next occurrence is today (missed ones skipped) | T-TK-102 |
| E3 | Completing a weekly task early (due Friday, done Tuesday) | The next occurrence is the following Friday (from the due date) | T-TK-103 |
| E4 | Reminder time already passed | Saved, with the `task.reminder_past` helper. Nothing is sent | T-TK-104 |
| E5 | "This task only" on a repeating task | Deletes it and creates the next occurrence | T-TK-105 |
| E6 | Toast Undo after completing a repeating task | Reopens it and deletes the generated occurrence | T-TK-106 |
| E7 | Completed on two devices offline | Per-field LWW on `done`. Only one next occurrence: it is created by the server when `done` first becomes true, and is unique on `previous_occurrence_id` | T-TK-107, OFF-20 |
| E8 | Edited on device A, deleted on device B | `deleted` is a field (ADR-004). The later write wins. If the delete wins, A's edit is dropped and A shows `app.conflict` | T-TK-108, OFF-21 |
| E9 | End time cleared while the start remains | Allowed (no end) | T-TK-109 |
| E10 | The due date moves to a day where the start/end would fall in a DST gap | ADR-006 shifts to the next valid minute. Floating time is shown as entered | T-TK-110 |
| E11 | Time zone changes (travel) | Floating times unchanged. `remind_at` recomputed in the new zone | T-TK-111 |
| E12 | The scheduler is down for 30 minutes | Reminders over 10 minutes late are skipped. The others are sent once | T-TK-112, PERF-03 |
| E13 | Opening details of a task deleted on another device | `error.not_found`, and back to the list | T-TK-113 |
| E14 | Project picker "New project…" from details | M07 sheet, then back with it selected | T-TK-114 |
| E15 | The yearly anchor is 29 Feb | 28 Feb in non-leap years. 29 Feb returns in leap years | T-TK-115 |
| E16 | Title edited to the same text | No patch is sent | T-TK-116 |

## 5. Copy keys

`task.completed`, `task.title_required`, `task.end_before_start`, `task.reminder_needs_date`, `task.reminder_past`, `task.created_by_assistant`, `task.from_note`, `task.delete_title`, `task.deleted`, `task.repeat_scope_title`, `task.repeat_this`, `task.repeat_future`, `task.push_explainer`, `task.push_denied`, `app.install_for_reminders`, `task.limit`, `app.conflict`, `error.save_failed`, `error.not_found`, `common.undo`.

## 6. Accessibility

- The checkbox has a 44 px hit area. Its name is "Complete {title}", and when done "Reopen {title}". A11Y-40
- Every details field has a visible label. The schedule error is linked with `aria-describedby` and announced assertively. A11Y-41
- The scope dialog is an `alertdialog`. Initial focus is on Cancel, because destructive buttons are never the default. A11Y-42
- The "Created by the assistant" tag is text, not just an icon. A11Y-43

## 7. API contract

Task IDs are **UUID v7, generated by the client**, so tasks can be created offline and creates are idempotent.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /tasks` | `{id, title, due_date?, start_time?, end_time?, priority?, project_id?, reminder?, repeat?, notes?}` | `201` task. A replay of a known `id` → `200` | `422` field errors, `task.limit`. `404` for someone else's `project_id` |
| `GET /tasks/{id}` | — | `200` | `404` |
| `PATCH /tasks/{id}` | Changed fields, plus `at` per field (ADR-004) | `200` task | `422`, `404` |
| `DELETE /tasks/{id}?scope=one\|future` | — | `204` | `404`. `422` if `scope` is missing on a repeating task |
| `POST /tasks/{id}/complete`, `/reopen` | `{at}` | `200 {task, next?}` | `404` |
| `POST /tasks/{id}/restore` | — | `200` (toast Undo for a delete) | `404`. `409 task.purged` |
| `POST /push-subscriptions` | `{endpoint, keys}` | `201` | `422` (not HTTPS) |
| `DELETE /push-subscriptions` | `{endpoint}` | `204` | — |

Offline edits use `POST /sync/patches` (ADR-004/005) with the same field rules.

## 8. Data, validation and authorization

- **New columns on `tasks`:** `repeat_anchor` (date) and `previous_occurrence_id` (unique, nullable).
- **Server validation mirrors the client:**
  - Title 1–200, notes ≤ 5,000
  - Enums
  - `end_time > start_time` (also a DB `CHECK`)
  - A reminder or repeat needs a `due_date`
  - `project_id` belongs to the user
- **Patch field allow-list:** title, due_date, start_time, end_time, priority, reminder, repeat, notes, project_id, done, deleted. `user_id`, `created_by` and `source_note_id` are never writable (SC-10, SEC-15).
- **Next occurrence:** created in the same transaction that sets `done = true`. `previous_occurrence_id` is unique, so a concurrent second complete can't create a second one (E7).
- **Ownership:** every route is scoped by `user_id`, and someone else's task returns `404` ([authorization matrix](../../07-architecture/threat-model.md#authorization-matrix)).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Editing someone else's task, or system fields | SC-10 plus the field allow-list | SEC-12, SEC-15 |
| A forged future `at` to always win a conflict | SC-17 clamp to server time + 5 min | SEC-14 |
| Registering someone else's push endpoint | SC-18 tied to the session user, HTTPS only | SEC-16 |
| Mass task creation | 5,000 open tasks per user, plus the general rate limit | SEC-10, SEC-11 |

## 10. Performance and scaling

- Complete and patch: write p95 ≤ 500 ms (SLO). The UI is optimistic, so the student never waits.
- Reminder scheduler: indexed `remind_at`, `SKIP LOCKED`. 300 reminders/minute delivered within 60 s (PERF-03).
- `change_seq` bumps on every write (ADR-005).

## 11. Analytics

| Event | Properties | Feeds |
|---|---|---|
| `task_completed` | assistant-made, overdue, repeating | Completion |
| `task_edited` | field, assistant-made, minutes since created | Edit rate |
| `task_deleted` | assistant-made, repeating, scope | — |
| `reminder_sent` | lateness in seconds, outcome (sent, expired subscription) | Reminder health |
| `push_permission` | result (granted, denied, dismissed) | Reminder reach |

## 12. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| TK-1 | Tapping the checkbox completes it, updates progress and shows a toast with Undo | T-TK-01 (component), T-TK-02 (E2E WF-06), T-TK-03 (Undo) |
| TK-2 | Every field is editable: title, schedule, due, reminder options, repeat options, priority, project, notes | T-TK-10 (one test per field, every option), T-TK-11 (patch per field) |
| TK-3 | An end before the start shows "End time must be later than the start time." | T-TK-20 (client), T-TK-21 (API `422`), T-TK-22 (DB `CHECK`) |
| TK-4 | Completing a repeating task creates the next one | T-TK-30 (each repeat type, with the anchor), T-TK-101–103, T-TK-115 |
| TK-4 | Deleting one asks "This task only" or "This and all future" | T-TK-31, T-TK-105 |
| TK-5 | Delete asks for confirmation and the toast offers Undo | T-TK-40, T-TK-41 (restore) |
| TK-6 | A notification fires at the offset from the start time, or from 09:00 on the due date | T-TK-50 (`remind_at` math with injected clock and zone), T-TK-51 (scheduler sends once), T-TK-52 (E2E push with a mocked push service) |
| — | Edge cases E1–E16 | T-TK-101–116 |
| — | Accessibility | A11Y-40–43 |
