# WF-06 — Complete a Task

**Trigger:** The student ticks a task's checkbox in any list, or writes "done X" in a note (NU-3).

## Main flow

1. The task is marked done (TK-1). Inbox progress updates (LV-1).
2. A toast confirms with **Undo** (e.g. "Nice work!", per the theme voice).
3. **Repeating task:** the next occurrence is created (TK-4).
4. When everything for today is done, Inbox shows "Nothing left for today" with a link to Upcoming (LV-1).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 2 | Undo tapped | The task is open again, and progress reverts |
| 1 | Offline | Saved on the device and synced later ([WF-05](WF-05-offline-capture-and-sync.md)) |
