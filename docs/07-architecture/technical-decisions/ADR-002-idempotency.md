# ADR-002 — Idempotency

**Status:** Accepted

## Context
Mobile networks drop responses, and clients retry. Without protection, a retried assistant message creates duplicate tasks, a repeated completion creates two next occurrences, and a re-run job sends a reminder twice (NFR-23).

## Decision
| Case | Mechanism |
|---|---|
| Assistant message | The client generates a UUID `Idempotency-Key`. `UNIQUE (user_id, request_id)` on `conversation_messages`. A retry returns the stored reply |
| Next occurrence | `UNIQUE (series_id, occurrence_date)` on `tasks`. Insert conflicts are ignored |
| Reminder | `UNIQUE (task_id, remind_at)` on `reminder_deliveries`. Mark it sent before pushing (at-most-once) |

## Consequences
- Duplicates are prevented by the database, not by application timing.
- At-most-once reminders: a crash between marking and sending loses that reminder. This is accepted over sending duplicates.
