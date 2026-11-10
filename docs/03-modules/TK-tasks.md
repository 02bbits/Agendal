# TK — Tasks

Working with a single task: completing, editing every field, schedule validation, repeating tasks, safe deletion and reminders.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md), [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md), [ADR-006](../07-architecture/decisions/ADR-006-time-zones.md), [business rules](../02-domain/business-rules.md#other-rules)

- **Screens:** Task details, task rows in every list ([screens and navigation](../01-product/screens.md))
- **Workflows:** [WF-06](../04-workflows/WF-06-complete-a-task.md)

TK covers one task: completing it, editing every field, repeats, deleting, and reminders. Decisions marked **([Q20](../08-project/open-questions.md#q20))** extend the PRD.

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="tk-1"></a>TK-1 | Complete a task | Must | Tapping the checkbox completes it, updates progress and shows a toast with Undo |
| <a id="tk-2"></a>TK-2 | Edit every field of a task | Must | Title, start date (with an optional start time), due date (with an optional due time), reminder (None; 5, 15 or 30 minutes; 1 hour; 1 day before), repeat (Never, Daily, Weekly, Monthly, Yearly), priority (Low, Medium, High), project and notes |
| <a id="tk-3"></a>TK-3 | Validate dates and times | Must | Start (date and time) must be before due (date and time) when both exist: "Start can't be after the due date." |
| <a id="tk-4"></a>TK-4 | Repeat tasks | Must | Completing a repeating task creates the next one; deleting one asks "This task only" or "This and all future" |
| <a id="tk-5"></a>TK-5 | Delete a task safely | Must | Delete asks for confirmation and the toast offers Undo |
| <a id="tk-6"></a>TK-6 | Remind before a task | Should | A notification fires at the chosen offset from the start time, or from 09:00 on the due date when there is no time |

## 1. Entry points and user stories

| Entry | Opens |
|---|---|
| Checkbox on any task row | Completes in place |
| Task row, a result row, a reminder notification | Task details |

- As a user, I tick a task and see my progress move, so that finishing feels good.
- As a user, I fix a date the assistant got wrong in two taps.
- As a user with a weekly meeting, I complete it and next week's appears by itself.
- As a user, I get a reminder before an exam, even with the app closed.

## 2. Behaviour detail

### 2.1 Complete (TK-1)

- **Ticking:**
  - The tick is optimistic ([UX-01](../01-product/ux-standards.md#ux-01)). The row strikes through, then moves to its list's completed area after 600 ms, so it doesn't jump out from under the user's thumb.
  - The progress line updates, and its new value is announced ([UX-62](../01-product/ux-standards.md#ux-62)).
  - The toast `task.completed` offers Undo.
- **Unticking** a completed task (in Completed, Search or details) reopens it. That doesn't show a toast.
- **Repeating task:** completing it creates the next occurrence (§2.3). Undo from the toast reopens the task and deletes that occurrence.

### 2.2 Task details and editing (TK-2, TK-3)

- **Row order:** the screen shows Title, Description (notes), Priority, then Project, Start date (with an optional start time), Due date (with an optional due time), Reminder, Repeat. The same chip and picker controls as the other rows; flags stay priority only.
- **Saving:** every field saves on change, or on blur for text. There is no Save button. Each save is a per-field patch ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)).
- **Title:** 1–200 characters. Cleared and blurred → it goes back to the previous value with `task.title_required`.
- **Project:** picker with No project, the user's projects and New project….
- **Start date:** date picker with quick choices. Optional, with a **No date** quick choice that clears it. The start time can be set only once there is a start date. Clearing the start date clears the start time.
- **Start time:** an optional time on the start date. Start (date and time) must be before due (date and time) when both exist ([TK-3](#tk-3), [BR-11](../02-domain/business-rules.md#br-11)).
- **Due date:** date picker with quick choices, with optional time (`due_time`).
  - The due time can be set only once there is a due date; **No date** clears both.
  - Start (date and time) must be before due (date and time) when both exist; otherwise shows `task.start_after_due` ("Start can't be after the due date.") and is not saved ([BR-11](../02-domain/business-rules.md#br-11), DB `CHECK`).
  - Clearing the due date clears the due time (and the reminder only if it counted from the due date). Clearing one date never clears the other date.
- **Reminder:**
  - Options: None, 5, 15 or 30 minutes, 1 hour, 1 day before.
  - Disabled when there is neither a start date nor a due date.
  - Offset counts from the start time; without one, from 09:00 on the start date; without a start date, from the due time; without a due time, from 09:00 on the due date ([BR-12](../02-domain/business-rules.md#br-12)).
  - A reminder time already passed shows `task.reminder_past`. It is still saved, and no notification is sent.
- **Repeat:** Never, Daily, Weekly, Monthly, Yearly. Choosing a repeat with no dates sets the due date to today.
- **Priority:** Low, Medium, High. Flags stay priority only.
- **Notes:** up to 5,000 characters, the box grows with the text.
- **Assistant tasks:** an assistant-made task shows `task.created_by_assistant` with the link `task.from_note` ("From note: {name}"), which opens the note's result ([NU-7](NU-note-understanding.md#nu-7)).
- **Footer:** "Created Mon 26 Oct · Edited Today 08:15" in footnote style.

### 2.3 Repeating tasks (TK-4)

- **Next occurrence ([Q20](../08-project/open-questions.md#q20)):**
  - Shifting: the next occurrence shifts start date and due date together by the period, keeping the gap between them and both times (`start_time`, `due_time`).
  - It comes from the **start date** (or the due date if the task has no start date), not the completion date. The due date then keeps the same number of days after the start, so at month ends it can land on a different day of the month. It is the first date in the series **after the current date** whose due date is **on or after today**. Missed occurrences are skipped, so they never pile up as overdue. A start date may still be in the past: the task then shows as in progress.
  - A gap longer than the repeat period is allowed: the next occurrence overlaps the old dates.
  - Daily progress on a long task = Repeat daily until the due date (existing UNTIL support).
- **Anchor:** each series keeps `repeat_anchor`, its first start date when there is one, else the due date.
  - Enum-only monthly schedules use the anchor's day, capped at the month's last day: 31 Jan → 28 Feb → 31 Mar.
  - Enum-only yearly schedules on 29 Feb use 28 Feb in non-leap years.
- **What the next occurrence copies:** title, project, priority, shifted start date, shifted due date, start time, due time, reminder offset, repeat frequency/rule, notes, anchor and `created_by`. It sets `previous_occurrence_id` (used by RV undo).
- **Delete** asks `task.repeat_scope_title`:
  - **This task only:** deletes this occurrence and creates the next one, so the series continues. Undo brings it back and removes that next one. A completed occurrence already has its next one, so nothing new is made.
  - **This and all future:** deletes this occurrence. No future ones exist yet, so the series ends.
  - Past completed occurrences are never touched.
- **Edit scope:** an edit applies to this occurrence and is carried into every later one, because each copies the previous one. There is no "edit all" dialog, since only one open occurrence ever exists.
- **Calendar rules from notes (IM-37 extension):** an optional `repeat_rule` stores interval, selected weekdays/month pattern and COUNT or UNTIL. These calendar rules skip impossible dates; enum-only legacy tasks keep the anchor-day clamping above. The frontend formats `repeat_rule` and `repeat_anchor` into a localized description in task details. Custom repeat controls are separate from note recognition.

### 2.4 Delete (TK-5)

- **Confirm first:** `task.delete_title`, with a red Delete and Cancel. A repeating task gets the scope dialog instead (§2.3).
- **After deleting:** a soft delete (`deleted_at`, [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)), then the toast `task.deleted` with Undo.
- **Deleted from details:** the screen goes back, and focus follows [UX-11](../01-product/ux-standards.md#ux-11).

### 2.5 Reminders (TK-6, Should)

- **Permission in context:**
  - The first time a reminder is set, by hand or by a note, an in-app explainer shows: `task.push_explainer` with Allow / Not now.
  - Allow triggers the browser's permission prompt. It is never asked at sign-in.
  - Not now is remembered for 14 days.
- **iOS:** push works only in the installed app (iOS 16.4+). In Safari, the explainer becomes `app.install_for_reminders`.
- **Scheduler ([ADR-006](../07-architecture/decisions/ADR-006-time-zones.md)):**
  - Runs every minute. It claims due `remind_at` rows with `FOR UPDATE SKIP LOCKED`.
  - Writes `reminder_deliveries (task_id, remind_at)` (unique) before sending, so a reminder is never sent twice.
  - Sends to every subscription the user has.
  - Skips done or deleted tasks, and reminders more than 10 minutes late (after downtime, a burst of stale reminders helps nobody).
- **Notification:** the title is the task title. The body is `Mon 09:00 · SQL Course`. Tapping it opens Task details.
- **Dead subscriptions:** a push service answering `404`/`410` deletes that subscription.
- **Devices:** a subscription belongs to the signed-in user, and an endpoint signing in to another account moves to it. Sign-out removes this device's subscription. A signed-in device that already has permission subscribes again when the app loads, with no prompt.
- **Setup:** sending needs `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the server, and the scheduler running (`reminders:send` every minute). Without the keys the job claims nothing, so no reminder is lost. The public key reaches the browser from `GET /push-subscriptions/key`.
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
| <a id="tk-e1"></a>TK-E1 | Monthly repeat on the 31st | Anchor day capped per month (§2.3) | T-TK-101 |
| <a id="tk-e2"></a>TK-E2 | Completing an overdue daily task 3 days late | The next occurrence is today (missed ones skipped) | T-TK-102 |
| <a id="tk-e3"></a>TK-E3 | Completing a weekly task early (due Friday, done Tuesday) | The next occurrence is the following Friday (from the due date) | T-TK-103 |
| <a id="tk-e4"></a>TK-E4 | Reminder time already passed | Saved, with the `task.reminder_past` helper. Nothing is sent | T-TK-104 |
| <a id="tk-e5"></a>TK-E5 | "This task only" on a repeating task | Deletes it and creates the next occurrence | T-TK-105 |
| <a id="tk-e6"></a>TK-E6 | Toast Undo after completing a repeating task | Reopens it and deletes the generated occurrence | T-TK-106 |
| <a id="tk-e7"></a>TK-E7 | Completed on two devices offline | Per-field LWW on `done`. Only one next occurrence: it is created by the server when `done` first becomes true, and is unique on `previous_occurrence_id` | T-TK-107, OFF-20 |
| <a id="tk-e8"></a>TK-E8 | Edited on device A, deleted on device B | `deleted` is a field ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)). The later write wins. If the delete wins, A's edit is dropped and A shows `app.conflict` | T-TK-108, OFF-21 |
| <a id="tk-e9"></a>TK-E9 | A task with a start time and no due time | Allowed: the due time is always optional, and the task keeps its due date | T-TK-109 |
| <a id="tk-e10"></a>TK-E10 | The start or due date moves to a day where the start time or due time would fall in a DST gap | [ADR-006](../07-architecture/decisions/ADR-006-time-zones.md) shifts to the next valid minute. Floating time is shown as entered | T-TK-110 |
| <a id="tk-e11"></a>TK-E11 | Time zone changes (travel) | Floating times unchanged. `remind_at` recomputed in the new zone | T-TK-111 |
| <a id="tk-e12"></a>TK-E12 | The scheduler is down for 30 minutes | Reminders over 10 minutes late are skipped. The others are sent once | T-TK-112, PERF-03 |
| <a id="tk-e13"></a>TK-E13 | Opening details of a task deleted on another device | `error.not_found`, and back to the list | T-TK-113 |
| <a id="tk-e14"></a>TK-E14 | Project picker "New project…" from details | PJ sheet, then back with it selected | T-TK-114 |
| <a id="tk-e15"></a>TK-E15 | The yearly anchor is 29 Feb | 28 Feb in non-leap years. 29 Feb returns in leap years | T-TK-115 |
| <a id="tk-e16"></a>TK-E16 | Title edited to the same text | No patch is sent | T-TK-116 |
| <a id="tk-e17"></a>TK-E17 | Start date after due date (`start_date > due_date`) | Client rejects with `task.start_after_due`, server returns 422, DB `CHECK` prevents save ([BR-11](../02-domain/business-rules.md#br-11)) | T-TK-117 |
| <a id="tk-e18"></a>TK-E18 | Start after due on the same day (start time later than due time) | Client rejects with task.start_after_due, server returns 422 ([BR-11](../02-domain/business-rules.md#br-11)) | T-TK-118 |
| <a id="tk-e19"></a>TK-E19 | Due time passed on the due day | Due label turns red, but task stays in Today until the day ends ([LV-E9](LV-lists-search.md#lv-e9)) | T-TK-119 |
| <a id="tk-e20"></a>TK-E20 | Start-only task with passed start day | Never overdue; rolls into Today as "Planned {date}" with start time greyed ([BR-23](../02-domain/business-rules.md#br-23)) | T-TK-120 |

## 5. Copy keys

`task.completed`, `task.title_required`, `task.end_before_start`, `task.reminder_needs_date`, `task.reminder_past`, `task.created_by_assistant`, `task.from_note`, `task.delete_title`, `task.deleted`, `task.repeat_scope_title`, `task.repeat_this`, `task.repeat_future`, `task.push_explainer`, `task.push_denied`, `app.install_for_reminders`, `task.limit`, `app.conflict`, `error.save_failed`, `error.not_found`, `common.undo`, `task.start_date`, `task.due_time`, `task.start_after_due`, `task.in_progress`, `task.planned`, `task.due_at`, `task.due_on`, `task.starts_at`, `task.starts_today`, `task.due_at_time`.

## 6. Accessibility

- The checkbox has a 44 px hit area. Its name is "Complete {title}", and when done "Reopen {title}". A11Y-40
- Every details field has a visible label. The schedule error is linked with `aria-describedby` and announced assertively. A11Y-41
- The scope dialog is an `alertdialog`. Initial focus is on Cancel, because destructive buttons are never the default. A11Y-42
- The "Created by the assistant" tag is text, not just an icon. A11Y-43

## 7. API contract

Task IDs are **UUID v7, generated by the client**, so tasks can be created offline and creates are idempotent.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /tasks` | `{id, title, start_date?, due_date?, start_time?, due_time?, priority?, project_id?, reminder?, repeat?, repeat_rule?, notes?}` | `201` task. A replay of a known `id` → `200` | `422` field errors, `task.start_after_due`, `task.limit`. `404` for someone else's `project_id` |
| `GET /tasks/{id}` | — | `200` | `404` |
| `PATCH /tasks/{id}` | Changed fields (including `start_date`, `due_time`), plus `at` per field ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)) | `200` task | `422` field errors, `task.start_after_due`, `404` |
| `DELETE /tasks/{id}?scope=one\|future` | — | `204`, or `200 {next}` when `scope=one` made the next occurrence | `404`. `422` if `scope` is missing on a repeating task |
| `POST /tasks/{id}/complete` | `{at}` | `200 {task, next?}`; add/merge the generated `next` by id | `404`, `422` field errors |
| `POST /tasks/{id}/reopen` | `{at}` | `200 {task, next?}`; remove the withdrawn `next` by id | `404`, `422` field errors or `task.limit` |
| `POST /tasks/{id}/restore` | — | `200` (toast Undo for a delete) | `404`. `409 task.purged` |

Offline edits use `POST /sync/patches` ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)/005) with the same field rules.

Task responses expose nullable `start_date`, `due_time`, `repeat_rule` and read-only `repeat_anchor` alongside the frequency enum `repeat`; older embedded note snapshots may omit them. The frontend formats the structured fields. The [shared recurrence contract](../07-architecture/api.md#task-recurrence-contract-im-37) specifies RRULE limits, write/clear semantics, completion/Undo, and the distinction between calendar skipping and legacy month-end clamping. Examples and machine-readable shapes live in [contracts](../07-architecture/contracts/schemas/task.schema.json).

## 8. Data, validation and authorization

- **Recurrence columns on `tasks`:** nullable `repeat_rule` (string, ≤ 300), `repeat_anchor` (date) and `previous_occurrence_id` (unique, nullable). Only `repeat_rule` is client-writable.
- **Server validation mirrors the client:**
  - Title 1–200, notes ≤ 5,000
  - Enums
  - Start (date and time) must be before due (date and time) when both exist (422 `task.start_after_due`, DB `CHECK`)
  - Times need their day: `start_time` without `start_date` → 422 on `start_date`; `due_time` without `due_date` → 422 on `due_date` (DB `CHECK`s too)
  - A reminder needs a `start_date` or `due_date`; repeat needs a `due_date` (or start date)
  - `project_id` belongs to the user
  - Migration: `end_time` is replaced by `due_time`. Existing tasks with `start_time`–`end_time` on one date migrate in the code issue to `start_date` = `due_date` = that date, `due_time` = the old end time.
- **Task PATCH field allow-list:** title, start_date, due_date, start_time, due_time, priority, reminder, repeat, repeat_rule, notes, project_id, plus `at`. Completion/deletion use their lifecycle endpoints. `repeat_anchor`, `previous_occurrence_id`, `user_id`, `created_by` and `source_note_id` are never client-writable ([SC-10](../07-architecture/security.md#sc-10), SEC-15). A non-null rule must match the merged frequency; COUNT and UNTIL are exclusive. A winning frequency-only patch clears the custom rule.
- **Next occurrence:** created in the same transaction that sets `done = true`. `previous_occurrence_id` is unique, so a concurrent second complete can't create a second one ([TK-E7](#tk-e7)).
- **Ownership:** every route is scoped by `user_id`, and someone else's task returns `404` ([authorization matrix](../07-architecture/security.md#authorization-matrix)).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Editing someone else's task, or system fields | [SC-10](../07-architecture/security.md#sc-10) plus the field allow-list | SEC-12, SEC-15 |
| A forged future `at` to always win a conflict | [SC-17](../07-architecture/security.md#sc-17) clamp to server time + 5 min | SEC-14 |
| Registering someone else's push endpoint | [SC-18](../07-architecture/security.md#sc-18) tied to the session user, HTTPS only | SEC-16 |
| Mass task creation | 5,000 open tasks per user, plus the general rate limit | SEC-10, SEC-11 |

## 10. Performance and scaling

- Complete and patch: write p95 ≤ 500 ms (SLO). The UI is optimistic, so the user never waits.
- Reminder scheduler: indexed `remind_at`, `SKIP LOCKED`. 300 reminders/minute delivered within 60 s (PERF-03).
- `change_seq` bumps on every write ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)).

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [TK-1](#tk-1) | Tapping the checkbox completes it, updates progress and shows a toast with Undo | T-TK-01 (component), T-TK-02 (E2E [WF-06](../04-workflows/WF-06-complete-a-task.md)), T-TK-03 (Undo) |
| [TK-2](#tk-2) | Every field is editable: title, start date (with optional start time), due date (with optional due time), reminder options, repeat options, priority, project, notes | T-TK-10 (one test per field, every option), T-TK-11 (patch per field) |
| [TK-3](#tk-3) | Start (date and time) must be before due (date and time) when both exist ("Start can't be after the due date.") | T-TK-20 (client), T-TK-21 (API `422`), T-TK-22 (DB `CHECK`) |
| [TK-4](#tk-4) | Completing a repeating task creates the next one | T-TK-30 (each repeat type, with the anchor), T-TK-101–103, T-TK-115 |
| [TK-4](#tk-4) | Deleting one asks "This task only" or "This and all future" | T-TK-31, T-TK-105 |
| [TK-5](#tk-5) | Delete asks for confirmation and the toast offers Undo | T-TK-40, T-TK-41 (restore) |
| [TK-6](#tk-6) | A notification fires at the offset from the start time, or from 09:00 on the due date | T-TK-50 (`remind_at` math with injected clock and zone), T-TK-51 (scheduler sends once), T-TK-52 (E2E push with a mocked push service) |
| — | Edge cases [TK-E1](#tk-e1)–[TK-E20](#tk-e20) | T-TK-101–120 |
| — | Accessibility | A11Y-40–43 |
