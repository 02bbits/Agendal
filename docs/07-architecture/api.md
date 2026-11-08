# API Design

Draft resource list. Once implemented, generated API docs are the source of truth.

## Conventions

- Base path `/api/v1`. JSON only, including errors, with correct status codes.
- Every resource is scoped to the signed-in user. Someone else's resource returns 404, so its existence isn't revealed ([NF-9](../05-quality/nfr.md#nf-9)).
- Every list is cursor-paginated: `?cursor=&limit=` (max 100), returning `next_cursor`.
- Rate limits and input limits: [security.md](../05-quality/nfr.md#rate-limits-nf-13). `429` carries `Retry-After`.
- Errors use one shape: `{"error": {"code": "note.too_many_items", "message": "…", "fields": {…}}}`. `code` is a [copy-catalog](../01-product/copy-catalog.md) key.
- Every request sends `X-Timezone` ([ADR-006](decisions/ADR-006-time-zones.md)). Writes send `X-XSRF-TOKEN` ([ADR-007](decisions/ADR-007-session-and-auth.md)).
- Tasks and projects have **client-generated UUID v7 ids**, so they can be created offline and a create replay returns `200` with the stored row ([TK module](../03-modules/TK-tasks.md#7-api-contract)).
- Full request/response contracts live in each module spec, section 7. This table is the index.
- The response shapes are also JSON Schemas in [contracts/schemas](contracts/schemas/), with example responses in [contracts/fixtures](contracts/fixtures/). A fixture uses the schema its name starts with (`note-result-done.json` → `note-result.schema.json`). The backend test `tests/Unit/ContractsTest.php` checks every fixture.
- Offline replays send a client id (notes) or per-field timestamps (task patches) ([ADR-003](decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-004](decisions/ADR-004-offline-sync-field-level-lww.md)).

## Resources

| Method & path | Purpose | Ref |
|---|---|---|
| `GET /sanctum/csrf-cookie` | Sets the XSRF cookie before the first write | [ADR-007](decisions/ADR-007-session-and-auth.md) |
| `POST /auth/register`, `/auth/login`, `/auth/logout` | Account and session. Login enforces the 3-attempt / 60 s lockout | [AA-1](../03-modules/AA-account-access.md#aa-1)–3, [AA-5](../03-modules/AA-account-access.md#aa-5) |
| `POST /auth/forgot-password`, `/auth/reset-password` | Reset. Same response whether or not the email exists | [AA-4](../03-modules/AA-account-access.md#aa-4) |
| `GET/PATCH /me` | Display name, theme, week start, time format, remember device, install prompt shown | [AP-1](../03-modules/AP-app-platform.md#ap-1), [AP-3](../03-modules/AP-app-platform.md#ap-3), [AP-5](../03-modules/AP-app-platform.md#ap-5) |
| `POST /notes` | Submit a note `{client_id, text, written_at, timezone, source_file_name?}` → `{status, name, changes \| plan}`. Full contract: [NU module](../03-modules/NU-note-understanding.md#7-api-contract) | [NC-2](../03-modules/NC-note-capture.md#nc-2), [NC-6](../03-modules/NC-note-capture.md#nc-6), [NU-1](../03-modules/NU-note-understanding.md#nu-1)–6, [RV-1](../03-modules/RV-review-control.md#rv-1) |
| `DELETE /notes/{id}` · `POST /notes/{id}/restore` | Soft-delete a note (`204`) and its toast's Undo (`200` note result; no-op on a live note); `404` for another user's note. Its tasks keep `source_note_id` while the note is only deleted | [RV §2.7](../03-modules/RV-review-control.md#27-delete-note) |
| `GET /notes`, `GET /notes/{id}` | Notes tab and a note's result | [RV-4](../03-modules/RV-review-control.md#rv-4), [RV-1](../03-modules/RV-review-control.md#rv-1) |
| `POST /notes/{id}/apply` | Confirm a `confirm` plan | [NU-5](../03-modules/NU-note-understanding.md#nu-5) |
| `POST /notes/{id}/make-task` | Keep a `followup` as a task (Edit the note uses `PUT /notes/{id}`) | [RV-3](../03-modules/RV-review-control.md#rv-3) |
| `PUT /notes/{id}` | Re-plan a `followup` in place with `{text, timezone}`; uses the server's edit time and the notes rate limiter. Editing applied notes is IM-47 | [RV-3](../03-modules/RV-review-control.md#rv-3) |
| `POST /notes/{id}/undo` · `/redo` | Undo all, and the toast's redo within 10 s | [RV-2](../03-modules/RV-review-control.md#rv-2), [RV module](../03-modules/RV-review-control.md#7-api-contract) |
| `POST /files/extract` | File (≤ 5 MB) → text. The file is discarded | [NC-4](../03-modules/NC-note-capture.md#nc-4), [NF-9](../05-quality/nfr.md#nf-9) |
| `GET /tasks?view=inbox\|upcoming&filter=` | Lists | [LV-1](../03-modules/LV-lists-search.md#lv-1), [LV-2](../03-modules/LV-lists-search.md#lv-2) |
| `GET /tasks/search?q=&status=all\|open\|completed&filter=&project_id=` | Search with counts | [LV-3](../03-modules/LV-lists-search.md#lv-3) |
| `GET /notes/search?q=` | Notes in Search: short snippets, at most 20 | [LV-3](../03-modules/LV-lists-search.md#lv-3) |
| `POST /tasks`, `GET/PATCH/DELETE /tasks/{id}` | Manual create, edit, delete (`?scope=one\|future` for repeating) | [NC-7](../03-modules/NC-note-capture.md#nc-7), [TK-2](../03-modules/TK-tasks.md#tk-2)–5 |
| `POST /tasks/{id}/complete`, `/reopen` | Complete, and toast Undo | [TK-1](../03-modules/TK-tasks.md#tk-1), [TK-4](../03-modules/TK-tasks.md#tk-4) |
| `POST /tasks/{id}/restore` | Toast Undo after a delete | [TK-5](../03-modules/TK-tasks.md#tk-5) |
| `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}?tasks=move\|delete` | Projects | [PJ-1](../03-modules/PJ-projects.md#pj-1)–4 |
| `POST /projects/{id}/restore` | Toast Undo after deleting a project | [PJ-4](../03-modules/PJ-projects.md#pj-4) |
| `POST /push-subscriptions`, `DELETE /push-subscriptions` | Register or remove a device for reminders | [TK-6](../03-modules/TK-tasks.md#tk-6) |
| `GET /sync?cursor=&limit=` | Pull changes since a cursor. `410` → full resync | [NF-6](../05-quality/nfr.md#nf-6), [ADR-005](decisions/ADR-005-sync-protocol.md) |
| `POST /sync/patches` | Push queued per-field edits `[{entity, id, field, value, at}]` | [NF-6](../05-quality/nfr.md#nf-6), [ADR-004](decisions/ADR-004-offline-sync-field-level-lww.md) |
| `POST /auth/logout-everywhere` | End all sessions (Should) | [ADR-007](decisions/ADR-007-session-and-auth.md) |

## Task fields

A task entity in API requests and responses exposes the following fields:

| Field | Type | Description |
|---|---|---|
| `id` | UUID v7 | Unique identifier, client-generated |
| `title` | string | 1–200 characters |
| `project_id` | UUID \| null | Associated project, or null |
| `start_date` | string \| null | Floating local date `YYYY-MM-DD` when work is planned |
| `start_time` | string \| null | Floating local time `HH:MM` when work starts on `start_date` |
| `due_date` | string \| null | Floating local date `YYYY-MM-DD` for the deadline |
| `due_time` | string \| null | Floating local time `HH:MM` for the deadline on `due_date` |
| `priority` | string \| null | `low`, `medium`, or `high` |
| `reminder` | string | `none`, `5m`, `15m`, `30m`, `1h`, `1d` |
| `repeat` | string | `never`, `daily`, `weekly`, `monthly`, `yearly` |
| `repeat_rule` | string \| null | RRULE string (≤ 300 characters) |
| `repeat_anchor` | string \| null | Original local date of the series (`start_date` if present, else `due_date`), read-only |
| `notes` | string \| null | Free text (≤ 5,000 characters) |
| `done` | boolean | Completion flag |
| `done_at` | string \| null | ISO 8601 timestamp |
| `created_by` | string | `user` or `assistant` |
| `source_note_id` | UUID \| null | Originating note id |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |

## Task recurrence contract (IM-37)

These fields apply to task responses, including `changes[].task` in a note result. Full examples: [task.json](contracts/fixtures/task.json) (no recurrence) and [task-recurring.json](contracts/fixtures/task-recurring.json) (Monday/Wednesday/Friday).

| Field | Shape | Meaning / ownership |
|---|---|---|
| `repeat` | `never`, `daily`, `weekly`, `monthly`, `yearly` | Frequency. Accepted by task create/patch and present in note plan create/update entries. It remains an enum. |
| `repeat_rule` | RRULE string, at most 300 characters, or `null` | Calendar configuration: interval, selected weekdays/month dates and an optional end. Accepted by task create/patch and present in note plan create/update entries. `null` uses the legacy enum-only schedule. |
| `repeat_anchor` | Local `YYYY-MM-DD` or `null` | Original date of the series, set by the server. Exposed on tasks; not writable by clients or note plan entries. Moving one occurrence does not move this anchor. |

Current task responses include both nullable fields. Their schema properties remain optional for older task snapshots embedded in note results. Clients must tolerate their absence there.

Example response fragment:

```json
{
  "start_date": "2026-10-31",
  "due_date": "2026-11-02",
  "due_time": null,
  "repeat": "weekly",
  "repeat_rule": "FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,WE,FR",
  "repeat_anchor": "2026-10-31"
}
```

### Writing a rule

- Use uppercase RRULE keys/values, with `FREQ` first and matching `repeat`. The supported components are `FREQ`, `INTERVAL`, `BYDAY`, `BYMONTHDAY`, `BYMONTH`, `WKST`, `COUNT` and `UNTIL`; keys cannot repeat. The backend checks RRULE semantics in addition to the JSON Schema's string shape.
- `INTERVAL` is 1–999 (default 1). `COUNT` is 1–10,000 and includes the first occurrence. Use either COUNT or UNTIL, never both. UNTIL is a UTC RRULE date-time; note date-only ends are encoded as `YYYYMMDDT235959Z`, inclusive of that floating local date.
- Invalid rules or a frequency mismatch in `POST/PATCH /tasks` return `422`, with a `repeat_rule` field error. A rule cannot accompany `repeat: never`.
- A winning `PATCH` of `repeat` without a winning `repeat_rule` clears the custom rule, even if the enum value is unchanged. To preserve or change a custom rule while writing the frequency, send both fields with consistent `at` timestamps. A `repeat_rule`-only patch is checked against the merged frequency.
- `repeat_anchor` is maintained by the server: enabling recurrence sets it from the due date, disabling recurrence clears it, and moving an occurrence preserves it. Calendar rules skip dates that do not exist; legacy enum-only monthly/yearly tasks keep their month-end clamping. See [TK §2.3](../03-modules/TK-tasks.md#23-repeating-tasks-tk-4).

The anchor is stored separately from the current occurrence's `due_date`. For example, a legacy monthly series anchored on `2026-01-31` has an occurrence due on `2026-02-28`; its anchor remains `2026-01-31`, so March returns to day 31. The same distinction lets the frontend describe the original schedule after a single occurrence is moved.

| Rule example | Meaning |
|---|---|
| `FREQ=MONTHLY;BYDAY=2MO` | The second Monday of each month |
| `FREQ=MONTHLY;BYMONTHDAY=-1` | The last day of each month |
| `FREQ=DAILY;INTERVAL=3;COUNT=5` | Every three days, five occurrences in total |
| `FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T235959Z` | Mondays through 31 December 2026; no occurrence after that local date |

### Notes with multiple tasks per scheduled day

`POST /notes` expands an explicit per-day count into separate ordinary plan `create` entries. For example, `visit house 3 times every day` produces refs `i1`, `i1-2`, `i1-3`, numbered titles and three independent daily rules, with `start_time: null`. Each saved task follows the same complete/reopen contract below. The expanded creates count toward the note limit of 30; exceeding it returns `422 note.too_many_items` without applying a partial plan. A per-day count is distinct from RRULE `COUNT`, which limits the number of recurrence dates in each series.

### Completing and reopening

Both endpoints return `200 {task, next?}`, with different meanings for `next`:

- `POST /tasks/{id}/complete`: `task` is the saved task; `next`, when present, is the generated occurrence to add/merge by id. A retry reuses the existing occurrence. Exhausted rules and a deliberately deleted child produce no `next`.
- `POST /tasks/{id}/reopen`: `task` is the reopened task; `next`, when present, is the uncompleted generated occurrence withdrawn by Undo, so clients remove it by id. An already-completed child is preserved. Recompletion can restore the withdrawn child using the task's current schedule without creating a duplicate.

Each operation applies per-field LWW and runs in a transaction. A stale `at` can leave the task unchanged. Reopening still enforces the 5,000-open-task limit after withdrawing the generated child.

### Presentation

The frontend's shared `describeRepeat(task, locale)` formats `repeat`, `repeat_rule` and `repeat_anchor` into English/Vietnamese text. Backend scheduling is authoritative. The PHP-only Try notes development page uses the RRULE library's own preview text.

### Saved Notes and preview exclusions

`GET /notes?cursor=&limit=20&filter=all` returns owner-scoped `{items, next_cursor, total, needs_count}`. Items are summaries (id, status, name, a 140-character excerpt, created/updated/deleted counts, written_at and source_file_name), ordered by written_at then id descending. Filters are all, made, needs (confirm/followup/pending). Limit is 1–50.

`POST /notes/{id}/apply` accepts optional `exclude: [ref]` alongside `edits`. Exclusions are stored in the plan audit data and never applied or included in Undo. Unknown or duplicate refs, or excluding every proposed change, return 422 without a write.
