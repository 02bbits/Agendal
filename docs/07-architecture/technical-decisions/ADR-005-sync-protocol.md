# ADR-005 — Sync Protocol: Cursor Pull Plus Field Patches

**Status:** Proposed

## Context
ADR-004 says how offline edits are **pushed**. Nothing says how a device **pulls** changes made on another device, or by a note processed on the server. Sync must work after days offline, without loss (NF-6), and at beta scale (A7).

## Decision
- **Change sequence.** Every write to `tasks`, `projects` and `notes` sets `change_seq` from one database sequence. A per-user index on `(user_id, change_seq)` makes pulls cheap.
- **Tombstones.** Deletes set `deleted_at` and bump `change_seq`. Rows are purged 30 days after deletion, unless an undoable note still needs them (ADR-002).
- **Pull.** `GET /sync?cursor=<seq>&limit=500` returns changed rows (tombstones included) after the cursor, plus `next_cursor` and `has_more`. A cursor older than the purge horizon gets `410 Gone`, and the client does a full resync.
- **Push.** Before pulling, the client sends queued edits as one batch, `POST /sync/patches` (per-field LWW, ADR-004). It then sends pending notes (ADR-003).
- **When to sync:** on app open, on reconnect, when the tab becomes visible, and every 60 s while visible. No WebSockets in the beta.
- **Order on reconnect:** push patches → push pending notes, oldest first → pull.

## Consequences
- One index serves every device. Pull cost grows with changes, not with data size.
- With up to 60 s of staleness between two open devices, the latest write still wins. Add server push (SSE/WebSocket) when usage shows two-device editing is common.
