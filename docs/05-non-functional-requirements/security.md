# Security and Privacy

Design detail: [security-design.md](../07-architecture/security-design.md)

| ID | Requirement |
|---|---|
| NF-9 | Notes, attached files and tasks belong to the account holder only; files are used to extract text and are not kept after extraction unless the user saves them; no note content in analytics |
| NF-10 | Passwords hashed (never stored or logged in plain text); HTTPS only; sign-in lockout per AA-3; reset links single-use and expire in 60 minutes |

## Engineering requirements added in the docs

These are not in the PRD. They make NF-9 and NF-10 testable. **Back-port them to the PRD** when it is next revised. Threats and tests: [threat model](../07-architecture/threat-model.md).

| ID | Requirement | Test |
|---|---|---|
| NF-13 | **Rate limits** per the table below. Exceeding one returns `429` with `Retry-After` and a copy-catalog message | SEC-10 |
| NF-14 | **Input limits** per the table below, enforced on the server (the client mirrors them for feedback) | SEC-11 |
| NF-15 | **Session** per [ADR-007](../07-architecture/technical-decisions/ADR-007-session-and-auth.md): first-party HttpOnly cookie, CSRF token, regenerated on sign-in, other sessions ended on password change | SEC-01–04 |
| NF-16 | **Security headers** on every response: strict CSP (`default-src 'self'`, no inline script, fonts from Google Fonts only), HSTS 1 year, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` allowing only the microphone on self, `frame-ancestors 'none'` | SEC-20 |
| NF-17 | **File upload pipeline:** size ≤ 5 MB, type from magic bytes (not the extension), allow-list, parsed in a sandboxed worker with a 10 s timeout and a 50 MB memory cap, extracted text ≤ 5,000 characters, the file deleted when extraction ends (success or failure), EXIF never read beyond OCR | SEC-30–35 |
| NF-18 | **LLM controls** per [ADR-008](../07-architecture/technical-decisions/ADR-008-llm-fallback.md): minimum context, schema-only output, server validation, per-user and global budgets, kill switch, no text in logs | SEC-40–44 |
| NF-19 | **Client data:** the service worker never caches authenticated API responses in the HTTP cache. Offline data lives in IndexedDB only, and sign-out wipes IndexedDB and SW data caches | SEC-50–51 |
| NF-20 | **Audit log** of security events (sign-in success/failure, lockout, reset requested/used, password changed, sign-out everywhere), with user ID, IP, user agent and time, kept 90 days. No passwords or tokens | SEC-60 |
| NF-21 | **Supply chain:** dependency audit (`composer audit`, `npm audit --omit=dev`) and secret scanning on every PR. High/critical findings block the merge | SEC-70 |

### Rate limits (NF-13)

| Scope | Limit | Key |
|---|---|---|
| Sign-in | 3 failures → 60 s lock (AA-3). 30 attempts / 10 min per IP. 20 failures / hour per email → 15 min lock | (email, IP), IP, email |
| Create account | 5 / hour per IP | IP |
| Password reset request | 3 / hour per email, 10 / hour per IP. Resend after 45 s | email, IP |
| `POST /notes` | 30 / min and 300 / day per user | user |
| LLM fallback | 20 notes / day per user (beyond that, rules only, with no error to the user) | user |
| `POST /files/extract` | 10 / hour and 30 / day per user | user |
| Search | 60 / min per user | user |
| `/sync` (pull and patches) | 30 / min per user | user |
| Everything else | 120 / min per user, 300 / min per IP for guests | user, IP |

### Input limits (NF-14)

| Field | Limit | When exceeded |
|---|---|---|
| Note text | 5,000 characters | Editor counter turns red at 4,500. Make tasks is disabled above 5,000 (`note.too_long`) |
| Items per note | 30 | Rejected before processing (`note.too_many_items`) |
| Task title | 200 characters | Notes: cut at a word boundary, the rest moves to task notes. Manual: field stops at 200 |
| Task notes | 5,000 characters | Field stops at the limit |
| Project name | 40 characters, unique per user (case-insensitive) | `project.name_taken` |
| Projects per user | 50 | `project.limit` |
| Open tasks per user | 5,000 | `task.limit` (far above the beta's expected use) |
| Email | 254 characters, normalised to lower case, trimmed | Field validation |
| Password | 8–128 characters | Field validation |
| Search query | 100 characters | Cut |
