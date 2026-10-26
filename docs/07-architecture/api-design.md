# API Design

Draft resource list. Once implemented, generated API docs are the source of truth.

## Conventions

- Base path `/api/v1`. JSON only, including errors, with correct status codes.
- Every resource is scoped to the signed-in user. Someone else's resource returns 404, so its existence isn't revealed (NF-9).
- Every list is cursor-paginated: `?cursor=&limit=` (max 100), returning `next_cursor`.
- Rate limits and input limits: [security.md](../05-non-functional-requirements/security.md#rate-limits-nf-13). `429` carries `Retry-After`.
- Errors use one shape: `{"error": {"code": "note.too_many_items", "message": "…", "fields": {…}}}`. `code` is a [copy-catalog](../01-product/copy-catalog.md) key.
- Every request sends `X-Timezone` (ADR-006). Writes send `X-XSRF-TOKEN` (ADR-007).
- Tasks and projects have **client-generated UUID v7 ids**, so they can be created offline and a create replay returns `200` with the stored row ([M05 spec](../03-modules/M05-tasks/spec.md#7-api-contract)).
- Full request/response contracts live in each module spec, section 7. This table is the index.
- Offline replays send a client id (notes) or per-field timestamps (task patches) ([ADR-003](technical-decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-004](technical-decisions/ADR-004-offline-sync-field-level-lww.md)).

## Resources

| Method & path | Purpose | Ref |
|---|---|---|
| `GET /sanctum/csrf-cookie` | Sets the XSRF cookie before the first write | ADR-007 |
| `POST /auth/register`, `/auth/login`, `/auth/logout` | Account and session. Login enforces the 3-attempt / 60 s lockout | AA-1–3, AA-5 |
| `POST /auth/forgot-password`, `/auth/reset-password` | Reset. Same response whether or not the email exists | AA-4 |
| `GET/PATCH /me` | Display name, theme, remember device, install prompt shown | AP-1, AP-3 |
| `POST /notes` | Submit a note `{client_id, text, written_at, timezone, source_file_name?}` → `{status, name, changes \| plan}`. Full contract: [M03 spec](../03-modules/M03-note-understanding/spec.md#7-api-contract) | NC-2, NC-6, NU-1–6, RV-1 |
| `GET /notes`, `GET /notes/{id}` | Notes tab and a note's result | RV-4, RV-1 |
| `POST /notes/{id}/apply` · `/cancel` | Confirm or cancel a `confirm` plan | NU-5 |
| `POST /notes/{id}/keep` · `/make-task` | Resolve a `followup` | RV-3 |
| `POST /notes/{id}/undo` · `/redo` | Undo all, and the toast's redo within 10 s | RV-2, [M04 spec](../03-modules/M04-review-control/spec.md#7-api-contract) |
| `POST /files/extract` | File (≤ 5 MB) → text. The file is discarded | NC-4, NF-9 |
| `GET /tasks?view=inbox\|upcoming&filter=` | Lists | LV-1, LV-2 |
| `GET /tasks/search?q=&status=all\|open\|completed` | Search with counts | LV-3 |
| `POST /tasks`, `GET/PATCH/DELETE /tasks/{id}` | Manual create, edit, delete (`?scope=one\|future` for repeating) | NC-7, TK-2–5 |
| `POST /tasks/{id}/complete`, `/reopen` | Complete, and toast Undo | TK-1, TK-4 |
| `POST /tasks/{id}/restore` | Toast Undo after a delete | TK-5 |
| `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}?tasks=move\|delete` | Projects | PJ-1–4 |
| `POST /projects/{id}/restore` | Toast Undo after deleting a project | PJ-4 |
| `POST /push-subscriptions`, `DELETE /push-subscriptions` | Register or remove a device for reminders | TK-6 |
| `GET /sync?cursor=&limit=` | Pull changes since a cursor. `410` → full resync | NF-6, ADR-005 |
| `POST /sync/patches` | Push queued per-field edits `[{entity, id, field, value, at}]` | NF-6, ADR-004 |
| `POST /auth/logout-everywhere` | End all sessions (Should) | ADR-007 |
