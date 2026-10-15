# ADR-003 — Notifications and Recurrence via Queued Jobs

**Status:** Accepted

## Context
Reminders, nudges, morning summaries, and next-occurrence creation are time-based and call slow or unreliable external services. Running them in the request cycle would slow responses (NFR-1) and lose work on failure (NFR-5).

## Decision
- The Laravel scheduler runs every minute and queues jobs for reminders due now, nudge candidates (BR-12), and users whose morning-summary time has arrived (in their time zone).
- Completing a repeating task dispatches a `CreateNextOccurrence` job.
- Jobs retry up to 3 times with backoff, then land in `failed_jobs`. Critical failures alert developers (NFR-27).
- Jobs re-check state when they run (task still open? toggle still on?) before sending.

## Consequences
- Requires an always-on queue worker and a cron entry for the scheduler in every environment ([deployment](../../05-non-functional-requirements/deployment.md)).
- Notification timing has up to ~1 minute of jitter.
