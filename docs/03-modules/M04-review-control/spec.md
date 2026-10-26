# M04 Review & Control — Spec

**Status:** Ready (approved 2026-10-26) · **Requirements:** [prd.md](prd.md) · **Depends on:** [ADR-002](../../07-architecture/technical-decisions/ADR-002-undo-change-log.md), [ADR-005](../../07-architecture/technical-decisions/ADR-005-sync-protocol.md), [M03 spec](../M03-note-understanding/spec.md), [state transitions](../../02-domain/state-transition.md)

M04 shows what a note did and lets the student change their mind: the result screen, Check this first, the follow-up question, Undo all, and the Notes tab. Decisions marked **(Q20)** extend the PRD and need sign-off. This spec proposes answers to Q9 (undo after a hand edit) and Q10 (undo window).

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| A note processed online | Result (`done`), Check this first (`confirm`) or the follow-up (`followup`) replaces the editor in history |
| A Notes card | The same screens, for any past note |
| Back-online toast | Notes tab, scrolled to the first note that needs a look |

- As a student, I see every task a note made or changed, so that I can trust it or fix it.
- As a student, I undo a wrong note in one tap, so that a misread costs me nothing.
- As a student, I untick one wrong change in Check this first, so that I don't have to cancel the whole note.
- As a student, I find an old note and see what it did.

## 2. Behaviour detail

### 2.1 Result screen (RV-1)

- **Header:**
  - The overline is the time plus counts: `Today 08:12 · 3 tasks made · 1 changed · 1 deleted`. Zero counts are left out.
  - The note name sits under the overline.
  - "From {file}" shows when the note came from a file.
  - The original note follows as a quote, collapsed to 4 lines with a Show all link.
- **Change rows, in plan order:**
  - Each row has a badge, the task title and its meta.
  - Created and changed rows open Task details. Deleted rows don't open.
  - A task removed since (by hand or by another note) shows `note.gone_since` and doesn't open.
  - Changed rows show the label with the old value ("Due Fri (was today)").
- **Skipped section** (`note.skipped`): each skipped item with its reason (`note.skip_already_done`, `note.skip_not_found`), or the plain text for `skip`.
- **Hints:** a duplicate row carries `note.duplicate_hint` (M03 E13).
- **Buttons:** Undo all (secondary) and Done (primary). Done returns to the screen the editor was opened from.
- **After undo:**
  - The overline says `Undone`.
  - Rows are muted and stop opening.
  - Undo all is hidden.
- **Editing from here:** edits made in Task details don't change the result rows. The rows show what the note did (ADR-002).

### 2.2 Check this first (NU-5)

- **Contents:** the same rows as the result, each with a checkbox, all ticked by default. A delete row has the red DELETED badge.
- **Ticking (Q20):**
  - Unticking a row removes it from the plan. Apply changes stays disabled until at least one row is ticked.
  - Unticked rows are kept in the plan JSON as `excluded`, and are not applied.
- **Ties (M03 E11):** the row shows "Which task did you mean?" with radio buttons for the candidates, the preselected one already chosen.
- **Buttons:**
  - **Apply changes** (primary, or red when the plan has a delete) sends the choices and exclusions.
  - **Cancel and keep the note** sets the status to `kept`.
- **Re-validation:** Apply re-checks the plan (M03 E38). If anything changed since, the result screen lists the skipped entries.
- **No expiry:** a `confirm` note waits indefinitely. Its Notes card shows `note.needs_look_one`.

### 2.3 Follow-up (RV-3)

- **Contents:** `note.followup_title`, the note quoted in full, then Keep as note (secondary) and Make it a task (primary).
- **Make it a task:**
  - The task's title is the note's first line, cut per M03 E16. The rest of the text goes into the task notes. No fields are extracted.
  - The note becomes `done`, with one created change, so Undo all works.
  - Task details then opens for the new task, so the student can add a date.
- **Keep as note:** the status becomes `kept`, and the screen returns to where the editor was opened from.

### 2.4 Undo all (RV-2): answers to Q9 and Q10 (Q20)

- **Window:** a note can be undone for **30 days** after it was processed. That matches the tombstone purge (ADR-005). After 30 days, Undo all is replaced by `note.undo_expired`.
- **Per change:**

| Change | Undo does | If the student touched it since |
|---|---|---|
| Created | Soft-deletes the task, and every occurrence generated from it by completion | Removed anyway. This counts as a conflict (below) |
| Changed (fields) | Restores each field the note changed, **only where the field still holds the note's value** | Fields the student changed since keep the student's value |
| Completed ("done X") | Reopens the task. For a repeating task, it also removes the next occurrence the completion created | A task already reopened stays open. An edited next occurrence counts as a conflict |
| Deleted | Restores the task | Already restored (toast Undo) → nothing to do |

- **Conflicts:** a conflict is any created task, or generated occurrence, that was edited or completed after the note. With at least one conflict, a dialog asks first: `note.undo_conflict_title` / `note.undo_conflict_body` with **Undo all** (red) and **Cancel**. With no conflicts, undo happens at once (one tap).
- **Restored task whose project is gone:** it goes to No project, and the result row says so (`note.project_gone`).
- **Atomic:** one transaction, in reverse log order. The note becomes `undone`.
- **Toast:** `note.undone` with Undo. That **redo** replays the undo's own log, restores the note to `done`, and is available while the toast is open (UX-04).
- **Needs a connection:** Undo all, Apply changes, Keep as note and Make it a task all act on the server's plan. Offline, these buttons are disabled with `note.needs_connection`.

### 2.5 Notes tab (RV-4)

- **Order:** newest first by `written_at` (offline notes sit where they were written). Ties break by `created_at`.
- **Pages:** 20 per page, keyset paginated, loaded when the list scrolls within one screen of the end.
- **Pending notes** come from IndexedDB, are merged in order, and show `note.waiting`.
- **Card:**
  - Time, using the UX-32 format
  - The name. A pending note has no name yet, so it shows its first words
  - A 2-line excerpt
  - A status line:

| Status | Status line |
|---|---|
| `done` | `note.made_*` (tasks made), or `note.overline_changed` when the note only changed tasks |
| `confirm`, `followup` | `note.needs_look_one` |
| `kept` | `note.kept_label` |
| `undone` | `note.undone_label` |
| `pending` | `note.waiting` |
| `422` on replay | `note.couldnt_process` (M03) |

- **Opening a card:** opens its screen per status. A pending card opens the editor with its text, read-only, with Delete note. Deleting a pending note removes it from the device before it syncs.
- **Empty state:** `note.list_empty`, plus a Write a note button.

## 3. State matrix

| Screen | Empty | Loading | Success | Partial | Error | Offline |
|---|---|---|---|---|---|---|
| Result | — | Skeleton after 300 ms (deep link only. Arriving from the editor, the data is already there) | Rows and buttons | Some rows `note.gone_since`. Skipped section shown | `404` → `error.not_found` with Back. `5xx` → `error.generic` with Retry | Cached result shown. Undo all disabled with `note.needs_connection` |
| Check this first | — | Same | Rows with checkboxes | Ties shown as radio groups | Apply fails: rows kept, `error.save_failed` with Retry | Apply and Cancel disabled with `note.needs_connection` |
| Follow-up | — | Same | Question and two buttons | — | Same as result | Buttons disabled with `note.needs_connection` |
| Notes tab | `note.list_empty` | Skeleton cards after 300 ms | Cards | Pending cards mixed in | Load-more failure: inline Retry at the end of the list | Cached notes plus pending ones. Older pages: `app.offline_body` at the end of the list |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| E1 | A task from the note was edited by hand, then Undo all (Q9) | Per §2.4: changed fields restored only where unchanged. Edited created tasks → conflict dialog, then removed | T-RV-101 |
| E2 | Undo all after 30 days (Q10) | Undo all is not shown. `note.undo_expired` is shown instead. The API returns `409 note.undo_expired` | T-RV-102 |
| E3 | The task's project was deleted since | Restored into No project. The row says `note.project_gone` | T-RV-103 |
| E4 | A completed repeating task is undone | Reopened. The generated next occurrence is removed (a conflict if it was edited) | T-RV-104 |
| E5 | Undo all tapped twice, or on two devices | The second request returns `200` with the note already `undone`. Nothing changes twice | T-RV-105 |
| E6 | Redo from the toast after the toast is gone | No longer possible. The note stays `undone` | T-RV-106 |
| E7 | Two notes changed the same field; the older note is undone | The field still holds the newer note's value, which isn't this note's value, so it isn't restored | T-RV-107 |
| E8 | A task the note deleted was purged | Can't happen within 30 days (ADR-005 keeps tombstones while a note can be undone) | T-RV-108 |
| E9 | Apply changes with every row unticked | Apply is disabled. To keep the note, use Cancel | T-RV-109 |
| E10 | A `confirm` note is applied days later, and its tasks changed | M03 E38: re-validated. The result lists the skipped entries | T-RV-110 |
| E11 | Make it a task on a note longer than 200 characters on its first line | Title cut at a word boundary. The rest goes into the task notes | T-RV-111 |
| E12 | Back from the result screen | Returns to the screen the editor was opened from, never to the editor (the editor was replaced in history) | T-RV-112 |
| E13 | A result row for a task deleted since | `note.gone_since`, doesn't open | T-RV-113 |
| E14 | A note's result opened on a second device before sync | The result comes from the server, and the lists pull the new tasks (ADR-005) | T-RV-114 |
| E15 | Deleting a pending (unsynced) note | Removed from the device and never sent. A note that has synced can't be deleted (Q1 decides whether notes become editable) | T-RV-115 |

## 5. Copy keys

`note.made_one`, `note.made_other`, `note.overline_changed`, `note.overline_deleted`, `note.badge_created`, `note.badge_changed`, `note.badge_deleted`, `note.was`, `note.from_file`, `note.skipped`, `note.skip_already_done`, `note.skip_not_found`, `note.duplicate_hint`, `note.gone_since`, `note.project_gone`, `note.undo_all`, `note.undone`, `note.undone_label`, `note.undo_expired`, `note.undo_conflict_title`, `note.undo_conflict_body`, `note.confirm_title`, `note.confirm_body_one`, `note.confirm_body_other`, `note.apply`, `note.cancel_keep`, `note.pick_task`, `note.followup_title`, `note.keep`, `note.make_one`, `note.kept_label`, `note.needs_look_one`, `note.needs_look_other`, `note.needs_connection`, `note.list_empty`, `note.waiting`, `common.done`, `common.undo`, `error.not_found`, `error.generic`, `error.save_failed`.

## 6. Accessibility

- When a result, confirm or follow-up screen opens, focus goes to its `h1`. The overline is part of the heading's accessible name (UX-61). A11Y-20
- Badges are text, not just colour. Each row's accessible name reads "Created: SQL quiz, Monday 09:00, SQL Course". A11Y-21
- Check this first rows are real checkboxes, and tie options are a `radiogroup` labelled "Which task did you mean?". A11Y-22
- After Undo all, the toast is announced and focus moves to the overline. A11Y-23
- Notes cards are links with their name, time and status line in the accessible name. A11Y-24

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /notes?cursor=&limit=20` | — | `200 {items: [note summary], next_cursor}`. A summary has id, status, name, excerpt (first 140 characters), counts, written_at, source_file_name | `401` |
| `GET /notes/{id}` | — | `200` note result (M03 §7) | `401`, `404` |
| `POST /notes/{id}/apply` | `{choices: {ref: task_id}, exclude: [ref]}` | `200` note result, status `done` | `409 note.wrong_status` (not `confirm`), `422` (a choice outside the candidates, every row excluded) |
| `POST /notes/{id}/cancel` | — | `200`, status `kept` | `409 note.wrong_status` |
| `POST /notes/{id}/keep` | — | `200`, status `kept` | `409 note.wrong_status` (not `followup`) |
| `POST /notes/{id}/make-task` | — | `201 {note, task}` | `409 note.wrong_status` |
| `POST /notes/{id}/undo` | `{confirm_conflicts: bool}` | `200` note result, status `undone`, plus `redo_until` | `409 note.undo_conflicts {tasks: [id, title]}` when there are conflicts and `confirm_conflicts` is false. `409 note.undo_expired` |
| `POST /notes/{id}/redo` | — | `200`, status `done` | `409 note.wrong_status` (not `undone`), `409 note.redo_expired` (past `redo_until` = undo + 10 s) |

- **State machine:** every action is valid only from the status in the [state transitions](../../02-domain/state-transition.md), plus `undone → done` for redo (ASVS 11.1.1).
- **Idempotency:** repeating an action that has already happened returns `200` with the current note (E5).
- **Limits:** these endpoints share the general limit of 120/min per user (NF-13).

## 8. Data, validation and authorization

- **Apply** runs in the same transaction pattern as M03 §8, with row locks on the matched tasks.
- **Undo** writes its own reverse log into `notes.undo_log` (json: `{task_id, before, after}`), so redo is exact. The undo log is cleared when redo expires.
- **Field ownership:** "the field still holds the note's value" compares the current value to the `after` value in `applied`. Per-field timestamps (ADR-004) aren't needed for this.
- **Ownership:** every note action checks that the note's `user_id` matches the session user. Other users' notes return `404` ([authorization matrix](../../07-architecture/threat-model.md#authorization-matrix)).
- **Sync:** every task touched by apply, undo or redo bumps `change_seq`, so other devices pull the result (ADR-005).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Applying or undoing someone else's note by ID | SC-10 scoped queries, `404` | SEC-12 |
| Choosing a task outside the candidate set on apply (to complete or delete an arbitrary task) | Choices validated against `ambiguous[].candidates` | SEC-17 |
| Hammering undo and redo to churn data | General rate limit. Redo only within 10 s | SEC-10 |

## 10. Performance and scaling

- Result and confirm come back in the `POST /notes` response, so there is no second round trip (NF-5).
- `GET /notes` uses `notes (user_id, written_at desc, id)`. Read p95 ≤ 300 ms (PERF-01).
- Undo of a 30-change note: one transaction, ≤ 150 ms p95.

## 11. Analytics

| Event | Properties | Feeds |
|---|---|---|
| `note_confirmed` | changes, excluded, ties | — |
| `note_cancelled` | changes | — |
| `note_undone` | minutes since processed, changes, conflicts | Note acceptance |
| `note_redone` | — | Accidental-undo rate |
| `note_followup_resolved` | choice (keep, task) | Follow-up rate |

## 12. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| RV-1 | Lists each created, changed and deleted task with a badge and its meta | T-RV-01 (component, every badge), T-RV-02 (meta and "was" label) |
| RV-1 | Created and changed tasks open their details. Deleted ones don't | T-RV-03, T-RV-113 |
| RV-2 | Undo all removes created tasks, reverts changes, restores deleted tasks | T-RV-10 (API, one test per change kind), T-RV-11 (E2E WF-04) |
| RV-2 | The note is kept and marked Undone | T-RV-12 |
| RV-2 | Undo is atomic and exact (NF-11) | T-RV-13 (a failure injected mid-undo → nothing changes) |
| RV-3 | "I couldn't find a task in this note." offers Keep as note or Make it a task | T-RV-20 (component), T-RV-21 (keep → `kept`), T-RV-22 (make → task created and details open) |
| RV-4 | The Notes tab lists notes newest first with time, name, excerpt and task count | T-RV-30 (order, including pending notes), T-RV-31 (card contents per status), T-RV-32 (pagination) |
| RV-4 | A card opens its result | T-RV-33 |
| NU-5 | Nothing is applied until Apply changes. Unticked rows aren't applied | T-RV-40, T-RV-41 |
| — | Status machine and idempotent actions | T-RV-50 (every invalid transition → `409`), T-RV-105 |
| — | Edge cases E1–E15 | T-RV-101–115 |
| — | Accessibility | A11Y-20–24 |
