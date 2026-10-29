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
| `GET /notes`, `GET /notes/{id}` | Notes tab and a note's result | [RV-4](../03-modules/RV-review-control.md#rv-4), [RV-1](../03-modules/RV-review-control.md#rv-1) |
| `POST /notes/{id}/apply` · `/cancel` | Confirm or cancel a `confirm` plan | [NU-5](../03-modules/NU-note-understanding.md#nu-5) |
| `POST /notes/{id}/keep` · `/make-task` | Resolve a `followup` | [RV-3](../03-modules/RV-review-control.md#rv-3) |
| `POST /notes/{id}/undo` · `/redo` | Undo all, and the toast's redo within 10 s | [RV-2](../03-modules/RV-review-control.md#rv-2), [RV module](../03-modules/RV-review-control.md#7-api-contract) |
| `POST /files/extract` | File (≤ 5 MB) → text. The file is discarded | [NC-4](../03-modules/NC-note-capture.md#nc-4), [NF-9](../05-quality/nfr.md#nf-9) |
| `GET /tasks?view=inbox\|upcoming&filter=` | Lists | [LV-1](../03-modules/LV-lists-search.md#lv-1), [LV-2](../03-modules/LV-lists-search.md#lv-2) |
| `GET /tasks/search?q=&status=all\|open\|completed` | Search with counts | [LV-3](../03-modules/LV-lists-search.md#lv-3) |
| `POST /tasks`, `GET/PATCH/DELETE /tasks/{id}` | Manual create, edit, delete (`?scope=one\|future` for repeating) | [NC-7](../03-modules/NC-note-capture.md#nc-7), [TK-2](../03-modules/TK-tasks.md#tk-2)–5 |
| `POST /tasks/{id}/complete`, `/reopen` | Complete, and toast Undo | [TK-1](../03-modules/TK-tasks.md#tk-1), [TK-4](../03-modules/TK-tasks.md#tk-4) |
| `POST /tasks/{id}/restore` | Toast Undo after a delete | [TK-5](../03-modules/TK-tasks.md#tk-5) |
| `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}?tasks=move\|delete` | Projects | [PJ-1](../03-modules/PJ-projects.md#pj-1)–4 |
| `POST /projects/{id}/restore` | Toast Undo after deleting a project | [PJ-4](../03-modules/PJ-projects.md#pj-4) |
| `POST /push-subscriptions`, `DELETE /push-subscriptions` | Register or remove a device for reminders | [TK-6](../03-modules/TK-tasks.md#tk-6) |
| `GET /sync?cursor=&limit=` | Pull changes since a cursor. `410` → full resync | [NF-6](../05-quality/nfr.md#nf-6), [ADR-005](decisions/ADR-005-sync-protocol.md) |
| `POST /sync/patches` | Push queued per-field edits `[{entity, id, field, value, at}]` | [NF-6](../05-quality/nfr.md#nf-6), [ADR-004](decisions/ADR-004-offline-sync-field-level-lww.md) |
| `POST /auth/logout-everywhere` | End all sessions (Should) | [ADR-007](decisions/ADR-007-session-and-auth.md) |
