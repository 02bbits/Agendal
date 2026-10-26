# PJ — Projects

Grouping tasks by area or goal: create with one of 8 colours, view progress, rename or recolour, and delete with a choice for its tasks.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md), [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md), [business rules](../02-domain/business-rules.md#other-rules)

- **Screens:** Projects, Project ([screens and navigation](../01-product/screens.md))
- **Workflows:** —

PJ groups tasks by area or goal: create, view, rename or recolour, and delete with a choice for the tasks.

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="pj-1"></a>PJ-1 | Create a project | Must | Name plus one of 8 colours; the new project opens straight away |
| <a id="pj-2"></a>PJ-2 | View a project | Must | Progress bar with "N of M tasks completed", then open and completed tasks |
| <a id="pj-3"></a>PJ-3 | Rename a project or change its colour | Should | Both available from the project's menu |
| <a id="pj-4"></a>PJ-4 | Delete a project | Must | A dialog asks whether to move its tasks to No project or delete them too; the toast offers Undo |

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| Projects tab | Projects list |
| A project row | Project |
| New project (list, or the project picker in New task / Task details) | Project sheet |

- As a user, I make one project per area of my life, so that tasks group themselves (notes match project names, NU).
- As a user, I see how far along each project is.
- As a user finishing a project, I delete it and choose what happens to its tasks.

## 2. Behaviour detail

### 2.1 Create (PJ-1)

- **Sheet fields:**
  - **Name:** 1–40 characters after trimming. Unique per user, case-insensitive (`project.name_taken`).
  - **Colour:** 8 swatches. The default is the first colour not used yet, or the first colour if all are used.
- **Create:**
  - The new project opens straight away ([PJ-1](#pj-1)).
  - From a picker, the sheet instead returns to the picker with the project selected.
- **Limit:** 50 projects (`project.limit`). At the limit, New project is disabled and shows the limit message.
- **Offline:** works. The project gets a client UUID (v7) and syncs through patches.

### 2.2 Projects list

- **Rows:** colour dot, name, progress text (`3 of 5`) and a thin progress bar.
- **Order:** alphabetical, locale-aware and case-insensitive. **No project** is a fixed last row: open tasks with no project, with no menu.
- **Empty:** `project.list_empty`, plus New project.

### 2.3 Project screen (PJ-2)

- **Progress bar:** `project.progress`. *M* counts every non-deleted task in the project (open and completed), and *N* counts the completed ones.
- **Open tasks:** by due date (no date last), then priority, then created.
- **Completed tasks:** below, newest completion first. The first 10 show, then `project.show_completed` loads more (keyset, 50 at a time).
- **Empty:** `project.empty` ("No tasks yet"), plus the capture bar. The `+` sheet opens with this project preselected (NC).
- **Menu:** rename, change colour, delete. No project has no menu.

### 2.4 Rename and recolour (PJ-3, Should)

- **Rename:** the same sheet as create, prefilled, with the same validation.
  - Renaming doesn't change task titles.
  - New notes match the new name (NU). The old name no longer matches.
- **Colour:** saves on tap. Every row using the project updates.

### 2.5 Delete (PJ-4)

- **No tasks:** `project.delete_title` with a red Delete and Cancel.
- **With tasks:** `project.delete_title` + `project.delete_body_*`, with two radio options:
  - **Move to No project** (default, safe)
  - **Delete them too** (red)
- **Delete them too:** tasks are soft-deleted. A repeating task's series ends (TK "This and all future").
- **Toast:** `project.deleted` with Undo. Undo restores the project and puts the moved tasks back in it, or restores the deleted tasks (§7 `restore`).
- **After deleting:** back to the Projects list.

## 3. State matrix

| Screen | Empty | Loading | Success | Error | Offline |
|---|---|---|---|---|---|
| Projects list | `project.list_empty` | From IndexedDB at once. First load: skeleton after 300 ms | Rows | `error.generic` with Retry | Works |
| Project | `project.empty` | Same | Progress and lists | `404` → `error.not_found` with Back | Works. Older completed pages show `app.offline_body` |
| Project sheet | Create disabled | Busy | Opens the project, or back to the picker | `project.name_taken`, `project.limit` | Works. Name uniqueness is re-checked on sync ([PJ-E3](#pj-e3)) |
| Delete dialog | — | Busy | Toast with Undo | `error.save_failed` | Works, queued |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| <a id="pj-e1"></a>PJ-E1 | Name differs only by case or spaces ("hci " vs "HCI") | Taken (trimmed, case-insensitive) | T-PJ-101 |
| <a id="pj-e2"></a>PJ-E2 | The 51st project | `project.limit`. Server `422` | T-PJ-102 |
| <a id="pj-e3"></a>PJ-E3 | Two devices create "HCI" offline | The second to sync is renamed "HCI (2)", and `app.conflict` explains it. Nothing is lost | T-PJ-103, OFF-30 |
| <a id="pj-e4"></a>PJ-E4 | Deleting a project while another device adds a task to it offline | The late task syncs into a deleted project and moves to No project. The toast explains it (`project.task_moved`) | T-PJ-104, OFF-31 |
| <a id="pj-e5"></a>PJ-E5 | Undo all on a note whose task belonged to a project deleted since | [RV-E3](RV-review-control.md#rv-e3): restored into No project | T-RV-103 |
| <a id="pj-e6"></a>PJ-E6 | Undo after "Delete them too" on a project with repeating tasks | Tasks and the project are restored. The series continues from the restored occurrence | T-PJ-106 |
| <a id="pj-e7"></a>PJ-E7 | Renaming a project to a name that some note keyword maps to | Allowed. A literal name beats keywords ([NU-E22](NU-note-understanding.md#nu-e22)) | T-PJ-107 |
| <a id="pj-e8"></a>PJ-E8 | Project name with emoji or diacritics | Allowed. Counted in characters, not bytes | T-PJ-108 |
| <a id="pj-e9"></a>PJ-E9 | The project toast Undo after its project was edited on another device | Restore works. Fields keep their latest values (LWW) | T-PJ-109 |

## 5. Copy keys

`project.none`, `project.new`, `project.progress`, `project.list_empty`, `project.empty`, `project.show_completed`, `project.delete_title`, `project.delete_body_one`, `project.delete_body_other`, `project.move_tasks`, `project.delete_tasks`, `project.deleted`, `project.name_taken`, `project.limit`, `project.task_moved`, `app.conflict`, `common.undo`.

## 6. Accessibility

- Colour swatches are a radio group with names ("Blue", "Green" …), so colour isn't the only identifier. The project name always shows next to the dot. A11Y-80
- The progress bar is a `progressbar` with `aria-valuetext` "3 of 5 tasks completed". A11Y-81
- The delete options are a radio group. Initial focus is on Cancel. A11Y-82

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /projects` | — | `200 [{id, name, colour, open, done}]` (≤ 50, no pagination) | `401` |
| `POST /projects` | `{id, name, colour}` (client UUID) | `201`. A replay of a known `id` → `200` | `422 project.name_taken`, `project.limit` |
| `GET /projects/{id}` | — | `200 {project, progress, open[], completed[], next_cursor}` | `404` |
| `PATCH /projects/{id}` | `{name?, colour?}` | `200` | `422`, `404` |
| `DELETE /projects/{id}?tasks=move\|delete` | — | `200 {undo: {task_ids[], mode}}` | `404`. `422` if `tasks` is missing and the project has tasks |
| `POST /projects/{id}/restore` | `{task_ids[], mode}` | `200` | `404`. `409 project.purged`. `422` for task IDs that aren't the user's or weren't part of the delete |

## 8. Data, validation and authorization

- **Constraints:** `UNIQUE (user_id, lower(name)) WHERE deleted_at IS NULL`. `colour` ∈ the 8 tokens. 50 projects per user, checked in the transaction.
- **Delete:** one transaction. The project gets `deleted_at`. Tasks get `project_id = null` (move) or `deleted_at` (delete). `change_seq` is bumped on all of them.
- **Restore:** accepts only task IDs that belong to the user and match the delete (moved: `project_id IS NULL`. Deleted: the same `deleted_at`).
- **Patch field allow-list:** name, colour, deleted.
- **Ownership:** someone else's project returns `404` ([authorization matrix](../07-architecture/security.md#authorization-matrix)).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Reading or deleting someone else's project | [SC-10](../07-architecture/security.md#sc-10) | SEC-12 |
| Restoring someone else's tasks through `restore` | Ownership and delete-match validation | SEC-18 |
| Creating projects in bulk | 50 cap, general rate limit | SEC-11 |

## 10. Performance and scaling

- `GET /projects` counts with one grouped query over `tasks (user_id, project_id, done)`. Read p95 ≤ 300 ms.
- Deleting a project with 500 tasks is one transaction, ≤ 300 ms p95.

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [PJ-1](#pj-1) | Name plus one of 8 colours | T-PJ-01, T-PJ-101 |
| [PJ-1](#pj-1) | The new project opens straight away | T-PJ-02 (from the list), T-PJ-03 (from a picker → selected) |
| [PJ-2](#pj-2) | A progress bar with "N of M tasks completed", then open and completed tasks | T-PJ-10 (math), T-PJ-11 (order and paging) |
| [PJ-3](#pj-3) | Rename and change colour from the menu | T-PJ-20, T-PJ-21 |
| [PJ-4](#pj-4) | The dialog offers Move to No project or Delete them too | T-PJ-30 (both modes, and the no-tasks variant) |
| [PJ-4](#pj-4) | The toast offers Undo | T-PJ-31 (restore, both modes), SEC-18 |
| — | Edge cases [PJ-E1](#pj-e1)–[PJ-E9](#pj-e9) | T-PJ-101–109 |
| — | Accessibility | A11Y-80–82 |
