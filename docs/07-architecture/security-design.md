# Security Design

How each security NFR is implemented. Requirements: [05-non-functional-requirements/security.md](../05-non-functional-requirements/security.md).

| Threat | Control | NFR |
|---|---|---|
| Password theft from DB | `Hash::make` (bcrypt/Argon2), min 8 chars | NFR-6 |
| Token misuse | Sanctum scoped tokens, revoked on logout and password reset | NFR-7 |
| SQL injection | Eloquent / bound parameters only | NFR-8 |
| XSS via task or AI text | React escaping. No `dangerouslySetInnerHTML` with user or AI content. Assistant output rendered as plain text or sanitised Markdown | NFR-8 |
| Session fixation / stale sessions | Regenerate session ID on login. 120 min idle expiry unless "Remember me" | NFR-9 |
| Brute force / abuse / AI cost | Rate limits: auth 5/min per email+IP; API 60/min per token; assistant 20/min and 200/day per user | NFR-10 |
| Accessing other users' data | Laravel Policies on every model. The assistant's actions use the **same** policies | NFR-11 |
| Data leakage to the AI vendor | Minimal context (message, relevant tasks, time zone). No-retention / no-training config. Keys only in server `.env`. Voice deleted after transcription | NFR-12 |
| Prompt injection | Whitelisted actions only, validated server-side. Task text passed as data ([ADR-001](technical-decisions/ADR-001-assistant-action-whitelist.md)) | NFR-13 |
| Secrets in repo | `.env` git-ignored. CI uses repository secrets | NFR-12 |
| Logging personal data | AI logs record latency, tokens, and outcome, never message text | NFR-27 |
