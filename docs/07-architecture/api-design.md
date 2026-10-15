# API Design

Draft resource list. Generated documentation is the source of truth once implemented (Scramble, NFR-26).

## Conventions

- Base path `/api/v1`. JSON only, including errors, with correct status codes (NFR-22).
- Auth: Sanctum bearer token (NFR-7). Every resource is scoped to the token's user (NFR-11).
- Errors: `401` unauthenticated, `403` not yours, `404` not found, `422` validation, `429` rate limited with `Retry-After` (NFR-10).
- Mutating assistant requests take an `Idempotency-Key` header ([ADR-002](technical-decisions/ADR-002-idempotency.md)).
- Offline-synced writes send the task `version`. On a conflict, last write wins and the response says which version was kept (NFR-24, [ADR-004](technical-decisions/ADR-004-offline-sync-conflict-resolution.md)).

## Resources

| Method & path | Purpose | FR |
|---|---|---|
| `POST /auth/register`, `/auth/login`, `/auth/logout` | Accounts | FR-01–03 |
| `POST /auth/forgot-password`, `/auth/reset-password` | Password reset | FR-04 |
| `DELETE /me` | Delete account and data | FR-06 |
| `GET/PATCH /me/preferences` | Preferences, notification toggles | FR-55, NFR-16 |
| `GET /tasks?project=&priority=&status=&due=&q=` | List, filter, search | FR-61, FR-64 |
| `GET /views/inbox`, `GET /views/upcoming` | Pre-ordered views | FR-44–49 |
| `POST /tasks`, `GET/PATCH/DELETE /tasks/{id}` | Task CRUD (`?scope=occurrence\|future` for repeating) | FR-23–31, FR-42 |
| `POST /tasks/{id}/complete`, `POST /tasks/{id}/reopen` | Completion | FR-27–28 |
| `GET/POST /projects`, `PATCH/DELETE /projects/{id}?tasks=delete\|move` | Projects | FR-33–38 |
| `POST /assistant/messages` (streamed) | Send a message | FR-07, FR-09–17 |
| `POST /assistant/transcriptions` | Voice → text | FR-08 |
| `GET /assistant/messages` | Conversation history | FR-22 |
| `POST /assistant/change-sets/{id}/undo` | Undo one reply | FR-20 |
| `POST /push-subscriptions` | Register a device for push | FR-57–58 |
