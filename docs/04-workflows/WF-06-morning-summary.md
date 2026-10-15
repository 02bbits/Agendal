# WF-06 — Morning Summary

**Trigger:** The user's chosen morning-summary time, in their time zone (FR-54, NFR-16).
**Actors:** Scheduler, queue worker, Web Push service.
**Preconditions:** The morning summary is enabled (FR-55), and notification permission is granted (FR-58).

## Main flow

1. The scheduler queues a summary job for each user whose time has arrived.
2. The job builds the list: today's tasks and overdue tasks.
3. A push notification is sent. Tapping it opens the Inbox View (FR-43).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 2 | Nothing due and nothing overdue | See [open questions](../08-project/open-questions.md) (skip or send a "clear day" message) |
| 3 | Send fails | Retried up to 3×, then `failed_jobs` (NFR-5) |
