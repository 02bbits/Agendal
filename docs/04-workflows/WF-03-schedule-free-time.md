# WF-03 — Schedule Free Time

**Trigger:** The user asks the assistant to find time, e.g. *"When can I work on my essay?"*
**Actors:** User, AI assistant.
**Preconditions:** At least one task without a scheduled time.

## Main flow

1. The assistant collects the user's scheduled tasks for the period.
2. It suggests free slots that avoid times already scheduled (FR-16).
3. The user accepts a slot.
4. The task gets that date, start, and end time (FR-29), validated by BR-01. A summary card is shown (FR-18).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 2 | No free slot found | The assistant says so and asks for a different period |
| 3 | User rejects all slots | Nothing changes |

**Related:** *"What should I do next?"* is answered from priority, due date, and scheduled time (FR-17), with no data change.
