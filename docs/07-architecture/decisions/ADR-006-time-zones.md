# ADR-006 — Time Zones: Floating Local Dates and Times

**Status:** Accepted ([Q16](../../08-project/open-questions.md#q16))

## Context
"Today", "tonight", overdue, the Inbox, reminders at 09:00 and repeating tasks all depend on the user's local time. The V2 data model has no time zone. Users travel, phones change zones, and DST shifts clocks.

## Decision
- **Store the zone.** `users.timezone` holds an IANA name (e.g. `Asia/Ho_Chi_Minh`). It is set at sign-up from `Intl.DateTimeFormat().resolvedOptions().timeZone`. The client sends `X-Timezone` on every request, and the server updates the stored zone when it changes.
- **Floating task times.** `due_date`, `start_time` and `end_time` are stored as **local wall-clock values with no zone**. "Quiz Mon 09:00" stays 09:00 wherever the user is.
- **Absolute reminders.** `remind_at` is stored in UTC. It is recomputed from the floating time and the current zone whenever the task or the zone changes. The scheduler queries `remind_at` only.
- **"Now" for a note** is the time the note was **written**, in the zone it was written in. The client sends `written_at` and `timezone` with each note, so an offline "tonight" means the night it was written ([ADR-003](ADR-003-offline-note-queue-and-idempotency.md)).
- **Derived values** (today, overdue, progress) use the user's current zone on the server and the device zone on the client. Both agree, because the client sends its zone.
- **DST.** A wall time that doesn't exist (spring forward) moves to the next valid minute. An ambiguous one (fall back) uses the first occurrence.

## Consequences
- Travelling doesn't move deadlines. Reminders follow the user's current zone.
- Every date computation takes `(now, timezone)` as input, which also makes the golden corpus reproducible (each case pins both).
