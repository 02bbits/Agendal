# ADR-004 — Offline Sync: Last Write Wins Per Field

**Status:** Accepted. Replaces V1's record-level last write wins.

## Context
Every edit works offline and syncs later without loss ([NF-6](../../05-quality/nfr.md#nf-6)). The same task may be edited on two devices, often on different fields (one sets the date, the other the project).

## Decision
- Offline edits are queued as per-field patches with the device timestamp: `{task_id, field, value, at}`.
- The server keeps `field_updated_at` per task. A patch is applied only if its `at` is newer than the stored timestamp for that field.
- Completion and deletion are fields too (`done`, `deleted`), so they follow the same rule.
- Stamps keep the millisecond and the device that wrote them (each call sends `X-Device-Id`, a UUID the device keeps until sign-out). In the same millisecond, the greater device id wins, whichever arrives first, so every device ends on the same value. The same device in the same millisecond: the later edit wins, since one device's queue arrives in order. Server writes carry no device.
- A write re-reads its row under a row lock before comparing stamps, so two writes at once can't drop each other's stamps.

## Consequences
- Edits to different fields both survive. Only a true same-field conflict loses the older value.
- Relies on roughly correct device clocks. The server can clamp timestamps from the future.
