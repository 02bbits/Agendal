# RV — Review & Control

Keeping the user in control of what the assistant did: the result screen lists every change, Undo all reverses a whole note, Edit note re-plans it, unclear notes get one question, and every note is kept.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-002](../07-architecture/decisions/ADR-002-undo-change-log.md), [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md), [NU module](NU-note-understanding.md), [state transitions](../02-domain/domain.md#state-transitions)

- **Screens:** Note result, Notes tab ([screens and navigation](../01-product/screens.md))
- **Workflows:** [WF-01](../04-workflows/WF-01-capture-and-process-note.md), [WF-03](../04-workflows/WF-03-resolve-unclear-note.md), [WF-04](../04-workflows/WF-04-undo-a-note.md)

RV shows what a note did and lets the user change their mind: the result screen, Check this first, the follow-up question, Undo all, Edit note and the Notes tab. Decisions marked **([Q20](../08-project/open-questions.md#q20))** extend the PRD and were approved with [Q9](../08-project/open-questions.md#q9) (undo after a hand edit) and [Q10](../08-project/open-questions.md#q10) (undo window). Edit note answers [Q1](../08-project/open-questions.md#q1), and the When? chips answer [Q4](../08-project/open-questions.md#q4).

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="rv-1"></a>RV-1 | Show what happened after every note | Must | The result screen lists each created, changed and deleted task with a CREATED / UPDATED / DELETED badge and its meta; created and changed tasks open their details; created tasks with no date offer When? chips ([Q4](../08-project/open-questions.md#q4)) |
| <a id="rv-2"></a>RV-2 | Undo a whole note in one tap | Must | Undo all removes created tasks, reverts changes and restores deleted tasks; the note is kept and marked Pending |
| <a id="rv-3"></a>RV-3 | Resolve unclear notes | Must | The screen says "I couldn't find a task in this note." and offers Keep it as task or Edit the note |
| <a id="rv-4"></a>RV-4 | Keep every note | Must | The Notes tab lists notes newest first with time, name, excerpt and task count; a card opens its result |
| <a id="rv-5"></a>RV-5 | Edit a note to re-plan it ([Q1](../08-project/open-questions.md#q1)) | Must | Edit note opens the note's text in the editor; Make tasks undoes what the note applied and plans the new text under the same safety rules; the card shows Edited |

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| A note processed online | Result (`done`), Check this first (`confirm`) or the follow-up (`followup`) replaces the editor in history |
| A Notes card | The same screens, for any past note |
| Back-online toast | Notes tab, scrolled to the first note that needs a look |

- As a user, I see every task a note made or changed, so that I can trust it or fix it.
- As a user, I undo a wrong note in one tap, so that a misread costs me nothing.
- As a user, I untick one wrong change in Check this first, so that I don't have to cancel the whole note.
- As a user, I find an old note and see what it did.

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
  - The meta is the row's `label` from the server ("Mon 26 Oct · 09:00 · SQL Course"). Changed rows add the old value: "Fri 30 Oct · HCI · was Wed 28 Oct".
  - A created row's label is its date, start time and project joined by " · ", empty parts left out, so a task with none of them has an empty meta. It never repeats the title. Times follow the user's time format when the note is applied ("9:00 am" in 12-hour, [UX-32](../01-product/ux-standards.md#ux-32)); the label keeps that format if the setting changes later.
  - A row's accessible name reads its badge, title and meta: "Created: SQL quiz, Mon 26 Oct · 09:00 · SQL Course" (A11Y-21).
- **Skipped section** (`note.skipped`): each skipped item with its reason (`note.skip_already_done`, `note.skip_not_found`, `note.skip_no_change`), or the plain text for `skip`.
- **Hints:** a duplicate row carries `note.duplicate_hint` ([NU-E13](NU-note-understanding.md#nu-e13)).
- **When? chips ([Q4](../08-project/open-questions.md#q4)):** a created row whose task has no due date shows `note.ask_when` with chips Today, Tomorrow, Next week and Pick date…. A chip sets the due date like an edit in Task details (`PATCH /tasks/{id}`), and the row's meta updates. The chips disappear once the task has a date, and after Undo all.
- **Buttons:** Undo all (secondary) and Done (primary). Done returns to the screen the editor was opened from. The header menu has **Edit note** (§2.5). The trash icon is **Delete note** (§2.7).
- **Where the data comes from:** after Make tasks the note is already in hand and isn't asked for again; opened by link, the note is loaded first. Either way each created and changed task is read by its id, so a task removed since shows `note.gone_since` and the When? chips follow the task's real date. The result takes the editor's place in the history, so Back goes to where the editor was opened ([RV-E12](#rv-e12)).
- **After undo:**
  - The overline says `notes.needs` (the note is `pending`).
  - Rows are muted and stop opening.
  - Undo all is hidden.
- **Editing from here:** edits made in Task details don't change the result rows. The rows show what the note did ([ADR-002](../07-architecture/decisions/ADR-002-undo-change-log.md)).

### 2.2 Check this first (NU-5)

- **Contents:** the overline `note.review_title`, the note's name, `note.confirm_body_*`, the quoted note, and the same rows as the result: a preview of what applying will do. Created and updated rows open Task details on the planned task, using a local form with Cancel and Done. Date, time, project, priority, reminder, repeat and notes reuse the shared Task details fields. Nothing is saved: Done updates the local preview and Apply sends the edits by ref; Cancel discards the form. When? chips remain on applied results only. A row rescheduled here shows its new date and time instead of the note's. Completing a task from there isn't a planned change and is refused. A delete row has the red DELETED badge and doesn't open.
- **Before tick boxes land:** the task editor offers **Don't add this task** for a creation, or **Don't apply this change** for an update. This omits the ref locally, with Undo omission; it never calls DELETE on an existing task. Apply sends `exclude`, rejects unknown/duplicate refs and refuses every row excluded. The tie picker remains deferred.
- **Ticking ([Q20](../08-project/open-questions.md#q20)):**
  - Unticking a row removes it from the plan. Apply changes stays disabled until at least one row is ticked.
  - Unticked rows are kept in the plan JSON as `excluded`, and are not applied.
- **Ties ([NU-E11](NU-note-understanding.md#nu-e11)):** the row shows "Which task did you mean?" with radio buttons for the candidates, the preselected one already chosen.
- **Buttons:**
  - **Apply changes** (primary, or red when the plan has a delete) sends the choices and exclusions. The app goes back to where the note was written, and a toast says `note.made_*` with Undo. Undo there is Undo all (§2.4) from the list, followed by the `note.undone` toast and its redo. If a created task was edited in those seconds, Undo opens the note's result screen instead, where the conflict dialog asks first.
  - **Edit note** (secondary) opens the editor with the note's text. Make tasks re-plans the same note (`PUT /notes/{id}`, §2.5).
  - Leaving (Back, ×, the backdrop or Escape) asks `note.discard_review_title` only when a task was edited or a row omitted. Discard drops those edits; with none, it goes back at once.
- **Re-validation:** Apply re-checks the plan ([NU-E38](NU-note-understanding.md#nu-e38)). If anything changed since, the result screen lists the skipped entries.
- **No expiry:** a `confirm` note waits indefinitely. Its Notes card shows `notes.needs`.

### 2.3 Follow-up (RV-3)

**IM-46 implementation:** follow-ups use the existing `/notes/{id}` screen, including deep links and reloads. `POST /notes/{id}/make-task` plans the whole text as one task and opens Check this first; Apply changes makes it through the normal applier and Undo log ([BR-01](../02-domain/business-rules.md#br-01)). A retry while it is in review returns the same review. `PUT /notes/{id}` re-plans a follow-up under the same id and client id, using the edit time and device zone, and exposes `edited_at`. The original `written_at` stays intact. Changed text on an already handled note returns `409 note.wrong_status`; unchanged text returns the stored result. General editing of applied notes remains IM-47. Saved-note edits do not replace the separate unsent new-note draft.

**Responsive implementation:** at 1280px and above, saved Notes stay visible behind a dimmed scrim beside a 400px modal result panel. Background navigation and capture controls are inert while it is open; focus stays inside the panel and closing restores interaction. Nested forms and pickers handle Escape before the parent panel. Below 1280px the selected note fills the content area; below 768px the sidebar is hidden. The same result and preview form remain mounted when resizing, so local edits survive. Pickers reuse the shared popover/sheet breakpoint at 768px. This includes a minimal saved-note list and status filters; pending/offline Notes-tab work remains IM-53.

- **Contents:** `note.followup_title`, the note quoted in full, then Edit the note (secondary) and Keep it as task (primary).
- **Keep it as task:**
  - The task's title is the note's whole text, with line breaks turned into spaces. Over 200 characters it is cut at a word boundary and the rest goes into the task notes ([NU-E16](NU-note-understanding.md#nu-e16)). No fields are extracted.
  - Like any change, it waits for Apply changes ([BR-01](../02-domain/business-rules.md#br-01)): the note becomes `confirm`, and Check this first (§2.2) shows the one planned task. Its row opens Task details, so the user can add a date first. The note's name is the task's title ([naming rules](../02-domain/business-rules.md#naming-a-note-nu-6)).
  - Apply changes makes the task, and the note becomes `done` with one created change, so Undo all works.
- **Edit the note:** opens the note's text in the editor, exactly like [Edit note](#25-edit-note-rv-5), with Make tasks reading `note.replan`. The status stays `followup` until Make tasks plans the new text. Closing the editor without Make tasks leaves the note as it was.
- **No other way out:** there is no "keep as a note" option. A note the user doesn't act on stays `followup`, and its Notes card shows `notes.needs` until they choose one of the two.

### 2.4 Undo all (RV-2): answers to Q9 and Q10 (Q20)

- **Window:** a note can be undone for **30 days** after it was processed. That matches the tombstone purge ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)). After 30 days, Undo all is replaced by `note.undo_expired`.
- **Per change:**

| Change | Undo does | If the user touched it since |
|---|---|---|
| Created | Soft-deletes the task, and every occurrence generated from it by completion | Removed anyway. This counts as a conflict (below) |
| Changed (fields) | Restores each field the note changed, **only where the field still holds the note's value** | Fields the user changed since keep the user's value |
| Completed ("done X") | Reopens the task. For a repeating task, it also removes the next occurrence the completion created | A task already reopened stays open. An edited next occurrence counts as a conflict |
| Deleted | Restores the task | Already restored (toast Undo) → nothing to do |

- **Conflicts:** a conflict is any created task, or generated occurrence, that was edited or completed after the note. With at least one conflict, a dialog asks first: `note.undo_conflict_title` / `note.undo_conflict_body` with **Undo all** (red) and **Cancel**. With no conflicts, undo happens at once (one tap).
- **Restored task whose project is gone:** it goes to No project, and the result row says so (`note.project_gone`).
- **Atomic:** one transaction, in reverse log order. The note becomes `pending`, with `redo_until`.
- **Toast:** `note.undone` with Undo. That **redo** replays the undo's own log, restores the note to `done`, and is available while the toast is open ([UX-04](../01-product/ux-standards.md#ux-04)).
- **Afterwards:** a `pending` note's result screen has **Make tasks again** (`note.replan`, primary) beside Edit note (secondary). It plans the note's current text again against the current tasks (`PUT /notes/{id}`, §2.5) and shows the new result.
- **Needs a connection:** Undo all, Apply changes, Keep it as task and Edit the note all act on the server's plan. Offline, these buttons are disabled with `note.needs_connection`.

### 2.5 Edit note (RV-5)

Answers [Q1](../08-project/open-questions.md#q1): editing a saved note re-plans it.

- **Where:** Edit note in the result screen's header menu, for notes in `done`, `confirm`, `followup` and `pending`. A `done` note past the 30-day undo window can't be edited, because its changes can no longer be undone ([RV-E17](#rv-e17)).
- **Editor:** opens with the note's text, in the same editor as a new note (NC). Make tasks reads `note.replan`.
- **What Make tasks does, in one transaction:**
  1. Undoes what the note applied, by the same rules as Undo all (§2.4). Conflicts show the same dialog first ([RV-E16](#rv-e16)). Notes in `confirm`, `followup` or `pending` have nothing applied, so this step does nothing.
  2. Plans the new text from scratch, with `now` = the time of the edit ([NU §2.1](NU-note-understanding.md#21-pipeline)).
  3. Applies the safety rules to the new plan: the result can be `done`, `confirm` or `followup`, like a new note.
- **Afterwards:** the result screen shows the new plan's changes. Undo all reverses only the new plan. The old text isn't kept. The note keeps its `id`, gets a new name, and its card shows `note.edited_label`.
- **Unchanged text:** Make tasks with the same text does nothing and returns to the result ([RV-E18](#rv-e18)). A `pending` note is the exception: its text is planned again (Make tasks again, §2.4).
- **Pending notes:** a note that hasn't synced yet is edited on the device. The new text replaces the queued one before it's sent ([RV-E19](#rv-e19)).
- **Needs a connection** for any synced note, like Undo all.

### 2.6 Notes tab (RV-4)

- **Order:** newest first by `written_at` (offline notes sit where they were written). Ties break by `created_at`.
- **Pages:** 20 per page, keyset paginated, loaded when the list scrolls within one screen of the end.
- **Pending notes** come from IndexedDB, are merged in order, and show `note.waiting`.
- **Card:**
  - Time, using the [UX-32](../01-product/ux-standards.md#ux-32) format
  - The name. A pending note has no name yet, so it shows its first words
  - A 2-line excerpt
  - A status line:

| Status | Status line |
|---|---|
| `done` | `notes.made` and the number of tasks it made, or changed when it made none: "Accepted · 2". Screen readers hear the full `note.made_*` or `note.overline_updated` |
| `confirm`, `followup`, `pending` (after Undo all) | `notes.needs` |
| Edited at least once | `note.edited_label` after the name, on the name's line ("Pay rent · Edited") |
| Saved offline, not yet sent | `note.waiting` |
| `422` on replay | `note.couldnt_process` (NU) |

- **Opening a card:** opens its screen per status. A pending card opens the editor with its text, editable, with Delete note. Deleting a pending note removes it from the device before it syncs.
- **Empty state:** `note.list_empty`, plus a Write a note button.

### 2.7 Delete note

- **Where:** the trash icon (`note.delete`) on the result screen and on the follow-up screen. It asks first: `note.delete_title` / `note.delete_body`. On confirm, a toast says `note.deleted` with Undo and the app goes back. The note is soft-deleted and leaves the list and counts. Undo calls `POST /notes/{id}/restore` and the Notes list refreshes.
- **Tasks are kept:** tasks made from the note stay and keep their source note while it is only deleted. Deleting doesn't undo the note's changes.

## 3. State matrix

| Screen | Empty | Loading | Success | Partial | Error | Offline |
|---|---|---|---|---|---|---|
| Result | — | Skeleton after 300 ms (deep link only. Arriving from the editor, the data is already there) | Rows and buttons | Some rows `note.gone_since`. Skipped section shown | `404` → `error.not_found` with Back. `5xx` → `error.generic` with Retry | Cached result shown. Undo all disabled with `note.needs_connection` |
| Check this first | — | Same | Rows with checkboxes | Ties shown as radio groups | Apply fails: rows kept, a toast says why | Apply and Edit note disabled with `note.needs_connection` |
| Follow-up | — | Same | Question and two buttons (Keep it as task, Edit the note) | — | Same as result | Buttons disabled with `note.needs_connection` |
| Notes tab | `note.list_empty` | Skeleton cards after 300 ms | Cards | Pending cards mixed in | Load-more failure: inline Retry at the end of the list | Cached notes plus pending ones. Older pages: `app.offline_body` at the end of the list |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| <a id="rv-e1"></a>RV-E1 | A task from the note was edited by hand, then Undo all ([Q9](../08-project/open-questions.md#q9)) | Per §2.4: changed fields restored only where unchanged. Edited created tasks → conflict dialog, then removed | T-RV-101 |
| <a id="rv-e2"></a>RV-E2 | Undo all after 30 days ([Q10](../08-project/open-questions.md#q10)) | Undo all is not shown. `note.undo_expired` is shown instead. The API returns `409 note.undo_expired` | T-RV-102 |
| <a id="rv-e3"></a>RV-E3 | The task's project was deleted since | Restored into No project. The row says `note.project_gone` | T-RV-103 |
| <a id="rv-e4"></a>RV-E4 | A completed repeating task is undone | Reopened. The generated next occurrence is removed (a conflict if it was edited) | T-RV-104 |
| <a id="rv-e5"></a>RV-E5 | Undo all tapped twice, or on two devices | A second Undo all on a `pending` note that still has its undo log returns `200` with the note as it is, already `pending`. A `pending` note with no undo log returns `409 note.wrong_status`. Nothing changes twice | T-RV-105 |
| <a id="rv-e6"></a>RV-E6 | Redo from the toast after the toast is gone | No longer possible: `409 note.redo_expired`. The note stays `pending`, and a second Undo all doesn't redo it either | T-RV-106 |
| <a id="rv-e7"></a>RV-E7 | Two notes changed the same field; the older note is undone | The field still holds the newer note's value, which isn't this note's value, so it isn't restored | T-RV-107 |
| <a id="rv-e8"></a>RV-E8 | A task the note deleted was purged | Can't happen within 30 days ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md) keeps tombstones while a note can be undone) | T-RV-108 |
| <a id="rv-e9"></a>RV-E9 | Apply changes with every row unticked | Apply is disabled. To keep the note, use Cancel | T-RV-109 |
| <a id="rv-e10"></a>RV-E10 | A `confirm` note is applied days later, and its tasks changed | [NU-E38](NU-note-understanding.md#nu-e38): re-validated. The result lists the skipped entries | T-RV-110 |
| <a id="rv-e11"></a>RV-E11 | Keep it as task on a note longer than 200 characters | Title cut at a word boundary. The rest goes into the task notes | T-RV-111 |
| <a id="rv-e12"></a>RV-E12 | Back from the result screen | Returns to the screen the editor was opened from, never to the editor (the editor was replaced in history) | T-RV-112 |
| <a id="rv-e13"></a>RV-E13 | A result row for a task deleted since | `note.gone_since`, doesn't open | T-RV-113 |
| <a id="rv-e14"></a>RV-E14 | A note's result opened on a second device before sync | The result comes from the server, and the lists pull the new tasks ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)) | T-RV-114 |
| <a id="rv-e15"></a>RV-E15 | Deleting a pending (unsynced) note | Removed from the device and never sent. A note that has synced can't be deleted, only edited ([RV-5](#rv-5)) | T-RV-115 |
| <a id="rv-e16"></a>RV-E16 | Edit note when a task from the note was edited by hand since | The Undo all conflict dialog shows first. Cancel keeps the note and its tasks as they are | T-RV-116 |
| <a id="rv-e17"></a>RV-E17 | Edit note on a `done` note older than 30 days | Edit note isn't shown. `PUT /notes/{id}` returns `409 note.undo_expired` | T-RV-117 |
| <a id="rv-e18"></a>RV-E18 | Make tasks with the text unchanged | Nothing happens. Returns `200` with the current result. Not for a `pending` note: it is planned again | T-RV-118 |
| <a id="rv-e19"></a>RV-E19 | Editing a pending note on the device | The queued text is replaced. The `client_id` stays the same, so the server sees only the final text | T-RV-119 |
| <a id="rv-e20"></a>RV-E20 | When? chip tapped offline | Saved on the device like any task edit and synced later ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)) | T-RV-120 |

## 5. Copy keys

`note.made_one`, `note.made_other`, `note.overline_updated`, `note.overline_deleted`, `note.badge_created`, `note.badge_updated`, `note.badge_deleted`, `note.was`, `note.from_file`, `note.skipped`, `note.skip_already_done`, `note.skip_not_found`, `note.skip_no_change`, `note.duplicate_hint`, `note.gone_since`, `note.project_gone`, `note.undo_all`, `note.undone`, `note.undo_expired`, `note.undo_conflict_title`, `note.undo_conflict_body`, `note.confirm_title`, `note.confirm_body_one`, `note.confirm_body_other`, `note.apply`, `note.cancel_keep`, `note.pick_task`, `note.followup_title`, `note.followup_edit`, `note.make_one`, `notes.made`, `notes.needs`, `note.needs_connection`, `note.list_empty`, `note.waiting`, `note.ask_when`, `note.edit`, `note.replan`, `note.edited_label`, `note.delete`, `note.delete_title`, `note.delete_body`, `note.deleted`, `common.done`, `common.undo`, `error.not_found`, `error.generic`, `error.save_failed`.

## 6. Accessibility

- When a result, confirm or follow-up screen opens, focus goes to its `h1`. The overline is part of the heading's accessible name ([UX-61](../01-product/ux-standards.md#ux-61)). A11Y-20
- Badges are text, not just colour. Each row's accessible name reads "Created: SQL quiz, Monday 09:00, SQL Course". A11Y-21
- Check this first rows are real checkboxes, and tie options are a `radiogroup` labelled "Which task did you mean?". A11Y-22
- After Undo all, the toast is announced and focus moves to the overline. A11Y-23
- Notes cards are links with their name, time and status line in the accessible name. A11Y-24

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /notes?cursor=&limit=20&filter=all` | Optional `filter`: `all`, `made`, `needs` (`confirm`, `followup`, `pending`); `limit`: 1–50, default 20 | `200 {items: [note summary], next_cursor, total, needs_count}` (`needs_count` counts `confirm`, `followup` and `pending`). Owner-scoped summaries ordered by written_at descending, then id descending; counts are created/updated/deleted. A summary has id, status, name, excerpt (first 140 characters), counts, written_at, source_file_name | `401` |
| `GET /notes/{id}` | — | `200` note result ([NU §7](NU-note-understanding.md#7-api-contract)) | `401`, `404` |
| `POST /notes/{id}/apply` | `{edits: {ref: {field: value}}, choices: {ref: task_id}, exclude: [ref]}`. `edits` holds what the user changed in Task details, by the `ref` each change carries, with only the fields a task patch may set (`422` otherwise). Edits are validated like the plan: a due time is the entry's end time, a start date may be set, and a new due date comes with the start date the screen showed, so the server doesn't derive one. An edited date or time on a move is kept, not planned again ([NU-E38](NU-note-understanding.md#nu-e38)). `plan_version` names the plan the user reviewed; repeating an apply that already landed (a lost reply) returns `200` with the note as it is. `exclude` is supported; `choices` is not built yet | `200` note result, status `done` | `409 note.wrong_status` (not `confirm`), `409 note.plan_changed` (`plan_version` is not the note's: re-planned since, e.g. Edit note on another device, even within the same second), `422` (an edit the plan can't take, a choice outside the candidates, every row excluded) |
| `POST /notes/{id}/make-task` | — | `200` note result, status `confirm`, with the one planned task. This is Keep it as task. A repeat while that review is open returns it as it is | `409 note.wrong_status` (not `followup`) |
| `POST /notes/{id}/undo` | `{confirm_conflicts: bool}` | `200` note result, status `pending`, plus `redo_until`. On a `pending` note that still has its undo log it changes nothing and returns the note as it is | `409 note.undo_conflicts {tasks: [id, title]}` when there are conflicts and `confirm_conflicts` is false. `409 note.undo_expired` |
| `POST /notes/{id}/redo` | — | `200`, status `done`. On a note already `done` it changes nothing and returns the note as it is, so a redo repeated after a lost reply doesn't fail (Idempotency, below) | `409 note.wrong_status` (`confirm` or `followup`), `409 note.redo_expired` (past `redo_until` = undo + 10 s) |
| `DELETE /notes/{id}` | — | `204`. Soft delete | `401`, `404` (including another user's note) |
| `POST /notes/{id}/restore` | — | `200` note result. A note that isn't deleted comes back unchanged | `401`, `404` (including another user's note) |
| `PUT /notes/{id}` | `{text, written_at, timezone, confirm_conflicts: bool}` | `200` note result ([NU §7](NU-note-understanding.md#7-api-contract)) for the new plan, status `done`, `confirm` or `followup` | `409 note.wrong_status` (`new`), `409 note.undo_conflicts`, `409 note.undo_expired`, `422` as for `POST /notes` |

- **State machine:** every action is valid only from the status in the [state transitions](../02-domain/domain.md#state-transitions), plus `pending → done` for redo and `→ new` for Edit note (ASVS 11.1.1).
- **Idempotency:** repeating an action that has already happened returns `200` with the current note ([RV-E5](#rv-e5)).
- **Limits:** these endpoints share the general limit of 300/min and 20/s per user ([NF-13](../05-quality/nfr.md#nf-13)).

## 8. Data, validation and authorization

- **Apply** runs in the same transaction pattern as [NU §8](NU-note-understanding.md#8-data-validation-and-authorization), with row locks on the matched tasks.
- **Undo** writes its own reverse log into `notes.undo_log` (json: `{redo_until, changes: [{task_id, before, after}]}`), so redo is exact and needs no extra column. The undo log is cleared when redo expires or succeeds.
- **Field ownership:** "the field still holds the note's value" compares the current value to the `after` value in `applied`. Per-field timestamps ([ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)) aren't needed for this.
- **Ownership:** every note action checks that the note's `user_id` matches the session user. Other users' notes return `404` ([authorization matrix](../07-architecture/security.md#authorization-matrix)).
- **Edit note** stores the new text, sets `notes.edited_at`, and replaces `plan` and `applied`. The undo and the new plan share one transaction, so a failure leaves the note as it was.
- **Sync:** every task touched by apply, undo, redo or edit bumps `change_seq`, so other devices pull the result ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Applying, undoing or editing someone else's note by ID | [SC-10](../07-architecture/security.md#sc-10) scoped queries, `404` | SEC-12 |
| Choosing a task outside the candidate set on apply (to complete or delete an arbitrary task) | Choices validated against `ambiguous[].candidates` | SEC-17 |
| Hammering undo and redo to churn data | General rate limit. Redo only within 10 s | SEC-10 |

## 10. Performance and scaling

- Result and confirm come back in the `POST /notes` response, so there is no second round trip. A `confirm` response's `changes` is a preview: the plan applied in a savepoint and rolled back, so its task ids are not the ones Apply makes ([NF-5](../05-quality/nfr.md#nf-5)).
- `GET /notes` uses `notes (user_id, written_at desc, id)`. Read p95 ≤ 300 ms (PERF-01).
- Undo of a 30-change note: one transaction, ≤ 150 ms p95.

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [RV-1](#rv-1) | Lists each created, changed and deleted task with a badge and its meta | T-RV-01 (component, every badge), T-RV-02 (meta and "was" label) |
| [RV-1](#rv-1) | Created and changed tasks open their details. Deleted ones don't | T-RV-03, T-RV-113 |
| [RV-2](#rv-2) | Undo all removes created tasks, reverts changes, restores deleted tasks | T-RV-10 (API, one test per change kind), T-RV-11 (E2E [WF-04](../04-workflows/WF-04-undo-a-note.md)) |
| [RV-2](#rv-2) | The note is kept and marked Pending | T-RV-12 |
| [RV-2](#rv-2) | Undo is atomic and exact ([NF-11](../05-quality/nfr.md#nf-11)) | T-RV-13 (a failure injected mid-undo → nothing changes) |
| [RV-3](#rv-3) | "I couldn't find a task in this note." offers Keep it as task or Edit the note | T-RV-20 (component), T-RV-22 (Keep it as task → Check this first with one task titled with the whole text; Apply changes makes it), T-RV-23 (Edit the note → editor opens with the text, status stays `followup`). T-RV-21 is retired |
| [RV-4](#rv-4) | The Notes tab lists notes newest first with time, name, excerpt and task count | T-RV-30 (order, including pending notes), T-RV-31 (card contents per status), T-RV-32 (pagination) |
| [RV-4](#rv-4) | A card opens its result | T-RV-33 |
| [RV-1](#rv-1) | Created tasks with no date offer When? chips ([Q4](../08-project/open-questions.md#q4)) | T-RV-04 (chips shown only without a date), T-RV-05 (a chip sets the date) |
| [RV-5](#rv-5) | Edit note opens the text in the editor | T-RV-60 |
| [RV-5](#rv-5) | Make tasks undoes the old plan and plans the new text under the same safety rules | T-RV-61 (API: old tasks removed, new ones created), T-RV-62 (new plan with a delete → `confirm`), T-RV-63 (a failure mid-edit → nothing changes) |
| [RV-5](#rv-5) | The card shows Edited | T-RV-64 |
| [NU-5](NU-note-understanding.md#nu-5) | Nothing is applied until Apply changes. Unticked rows aren't applied | T-RV-40, T-RV-41 |
| — | Status machine and idempotent actions | T-RV-50 (every invalid transition → `409`), T-RV-105 |
| — | Edge cases [RV-E1](#rv-e1)–[RV-E20](#rv-e20) | T-RV-101–120 |
| — | Accessibility | A11Y-20–24 |
