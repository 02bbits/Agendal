# WF-05 — Reminder and Nudge

**Trigger:** A reminder time is reached, or a nudge condition becomes true (BR-12).
**Actors:** Scheduler, queue worker, Web Push service, user.
**Preconditions:** The user granted notification permission (FR-58).

## Main flow

1. The scheduler finds due reminders and nudge candidates and queues jobs (NFR-5).
2. The worker sends a push notification (FR-57, FR-53). Each reminder is sent once (NFR-23).
3. The user taps the notification, and the related task opens (FR-60).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 1 | Task completed, deleted, or reminder removed (FR-59) | Nothing sent |
| 1 | Nudges disabled (FR-55) | No nudge |
| 2 | Push service fails | Retried up to 3×, then logged to `failed_jobs` (NFR-5). The app keeps working (NFR-22) |
| — | Permission denied | No push. In-app indicators (overdue label) still apply |
