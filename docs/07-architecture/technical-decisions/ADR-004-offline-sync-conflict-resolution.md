# ADR-004 — Offline Sync: Last Write Wins

**Status:** Accepted

## Context
Users can edit tasks offline (FR-67). The same task may change on two devices before both sync (NFR-24).

## Decision
- The service worker queues offline mutations with a client timestamp and the task `version` they were based on. The queue is flushed within 30 s of reconnecting.
- The server applies the **latest** change by timestamp. When the base version is stale, the response flags the conflict, and the client tells the user which version was kept.
- The assistant is disabled offline, so only manual mutations are queued.

## Consequences
- Simple and predictable, but a concurrent edit to a *different* field on another device can be overwritten. Upgrade path: field-level merge if users report lost edits.
- Relies on device clocks being roughly correct.
