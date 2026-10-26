# WF-05 — Offline Capture and Sync

**Trigger:** The device loses its connection.

## Main flow

1. A "You're offline" banner shows on list screens ([AP-2](../03-modules/AP-app-platform.md#ap-2)).
2. Lists, task edits and the manual New task sheet keep working. Edits are saved on the device and queued ([NF-6](../05-quality/nfr.md#nf-6)).
3. In the note editor, the button reads **Save note**. The note is stored on the device as "Waiting for connection" (status `pending`) ([NC-6](../03-modules/NC-note-capture.md#nc-6)).
4. On reconnect, queued edits sync. Pending notes are processed **in order** under the same rules ([BR-04](../02-domain/business-rules.md#br-04)).
5. A toast reports "Back online. N notes turned into M tasks."

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 4 | The same field was changed on two devices | Last write wins per field ([BR-21](../02-domain/business-rules.md#br-21), [ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)) |
| 4 | A pending note's plan needs confirmation | It waits for Apply changes ([WF-02](WF-02-confirm-risky-changes.md)) |
| 4 | A command no longer matches an open task | Treated as a new task ([NU-3](../03-modules/NU-note-understanding.md#nu-3)) |
