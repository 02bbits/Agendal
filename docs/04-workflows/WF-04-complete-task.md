# WF-04 — Complete a Task

**Trigger:** The user marks a task complete (Inbox, list, task detail, or via the assistant).
**Actors:** User, system.

## Main flow

1. The task is marked complete (FR-27, FR-47), responding within 1 s (NFR-1).
2. An encouragement message is shown, if enabled (FR-52, FR-55).
3. The Inbox progress (FR-46) and project progress (FR-37) update in every view (FR-51).
4. Its pending reminder is cancelled.
5. **Repeating task:** a queued job creates the next occurrence (FR-41, NFR-5). It is skipped when past the end date (FR-40), and never created twice (NFR-23).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 1 | Completed by mistake | The user reopens the task (FR-28) |
| 1 | Offline | Saved locally and synced when back online (FR-67, NFR-24) |
