# Technical Decisions (ADRs)

One file per significant decision: `ADR-nnn-short-title.md`, with sections *Status, Context, Decision, Consequences*. Supersede an ADR with a new one instead of editing it. The V1 ADRs (chat assistant) were retired with the concept change and remain in git history.

| ADR | Title | Status |
|---|---|---|
| [ADR-001](ADR-001-note-plan-contract.md) | Every note produces a plan of one fixed shape | Accepted |
| [ADR-002](ADR-002-undo-change-log.md) | Undo through a per-note change log | Accepted |
| [ADR-003](ADR-003-offline-note-queue-and-idempotency.md) | Offline note queue with client ids | Accepted |
| [ADR-004](ADR-004-offline-sync-field-level-lww.md) | Offline sync: last write wins per field | Accepted |
| [ADR-005](ADR-005-sync-protocol.md) | Sync protocol: cursor pull plus field patches | Accepted |
| [ADR-006](ADR-006-time-zones.md) | Time zones: floating local dates and times | Accepted |
| [ADR-007](ADR-007-session-and-auth.md) | Session and authentication model | Accepted |
| [ADR-008](ADR-008-llm-fallback.md) | Language-model fallback for note understanding | Accepted |

[ADR-005](ADR-005-sync-protocol.md) to [ADR-008](ADR-008-llm-fallback.md) were approved on 2026-10-26 ([Q16](../../08-project/open-questions.md#q16)).
