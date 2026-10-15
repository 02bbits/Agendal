# Reliability

| ID | Name | Description |
|---|---|---|
| NFR-21 | Transaction integrity | All changes from one assistant reply are applied in one DB::transaction(), so they fully succeed or fully roll back. Undo restores them in one transaction. Deleting a project moves or deletes its tasks atomically. |
| NFR-22 | Error handling | Custom error pages (Next.js not-found.tsx and error.tsx) cover 403/404/419/429/500; the API always returns JSON errors with correct HTTP status codes. If the AI provider, speech service, mail, or push service fails or times out (> 15 s for AI, > 10 s otherwise), the rest of the app keeps working, manual task creation stays available, the user sees a clear message, and the error is logged. |
| NFR-23 | Idempotency | Each assistant request carries a unique request ID, so a retried request never creates duplicate tasks. A repeating task has at most one next occurrence per date (unique index on series ID + occurrence date). Each reminder is sent at most once. |
| NFR-24 | Offline sync | Changes made offline are uploaded within 30 seconds of the connection returning. If the same task changed on two devices, the latest change wins and the user is told which version was kept. |
