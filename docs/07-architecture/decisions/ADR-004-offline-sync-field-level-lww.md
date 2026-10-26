# ADR-004 — Offline Sync: Last Write Wins Per Field

**Status:** Accepted. Replaces V1's record-level last write wins.

## Context
Every edit works offline and syncs later without loss ([NF-6](../../05-quality/nfr.md#nf-6)). The same task may be edited on two devices, often on different fields (one sets the date, the other the project).

## Decision
- Offline edits are queued as per-field patches with the device timestamp: `{task_id, field, value, at}`.
- The server keeps `field_updated_at` per task. A patch is applied only if its `at` is newer than the stored timestamp for that field.
- Completion and deletion are fields too (`done`, `deleted`), so they follow the same rule.

## Consequences
- Edits to different fields both survive. Only a true same-field conflict loses the older value.
- Relies on roughly correct device clocks. The server can clamp timestamps from the future.
