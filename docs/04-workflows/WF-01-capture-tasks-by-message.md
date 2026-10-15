# WF-01 — Capture Tasks by Message

**Trigger:** The user sends a message to the assistant.
**Actors:** User, AI assistant, AI provider, speech-to-text service.
**Preconditions:** Logged in and online.

## Main flow

1. The user types a message (FR-07), or records one by voice (FR-08).
2. *Voice only:* the transcription appears within 2 s (NFR-2), and the user corrects it before sending.
3. The client sends the message with a unique request ID (NFR-23).
4. The server sends the message, the relevant tasks, and the user's time zone to the AI provider (NFR-12).
5. The assistant identifies every task in the message (FR-09) and resolves relative dates (FR-10). It also infers the due date, scheduled time, priority, reminder (FR-11), project (FR-12), and recurrence (FR-39).
6. The server validates each proposed action (ownership, dates, priority) (NFR-13) and applies them all in one transaction (NFR-21).
7. The reply streams back within 3 s and finishes within 10 s for up to 5 tasks (NFR-2). A summary card lists every created task (FR-18).
8. All views update without reload (FR-51).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 5 | Message too unclear | The assistant asks one short follow-up question. No tasks created (FR-13) |
| 5 | Would delete a task or change > 5 tasks | Ask for confirmation first (FR-21) |
| 3 | Same request ID retried | The original result is returned. No duplicates (NFR-23) |
| 4 | AI provider fails or takes > 15 s | Clear error shown. The message is kept for resend. Manual creation still works (NFR-17, NFR-22) |
| 1 | Offline | The assistant shows as unavailable (FR-67) |
| 1 | Rate limit exceeded | HTTP 429 with Retry-After (NFR-10) |

**Postconditions:** Tasks exist, the change set is recorded and undoable, and reminders are queued.
