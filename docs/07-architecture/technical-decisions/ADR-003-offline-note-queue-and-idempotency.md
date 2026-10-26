# ADR-003 — Offline Note Queue With Client IDs

**Status:** Accepted

## Context
Notes written offline must be processed on reconnect, in order, under the same rules (NC-6, BR-04). Flaky mobile networks also make clients retry, and a retried note must never create its tasks twice.

## Decision
- The client gives every note a UUID `client_id` when it is written, and stores pending notes in IndexedDB.
- On reconnect, the service worker replays queued task edits first, then pending notes **oldest first**, one at a time.
- `UNIQUE (user_id, client_id)` on `notes`. A replay of a known id returns the stored result instead of processing again.
- The client totals the replies for the toast "Back online. N notes turned into M tasks."

## Consequences
- Duplicates are prevented by the database, not by timing.
- A pending note may act on tasks that changed since it was written. The same confirmation rules apply. Commands with no match follow the M03 rule ([E29](../../03-modules/M03-note-understanding/spec.md#4-edge-cases)): an unmatched reschedule becomes a new task, an unmatched complete or delete is skipped.
