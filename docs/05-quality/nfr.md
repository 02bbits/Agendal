# Non-Functional Requirements

Quality targets. [NF-1](#nf-1)–12 come from the PRD; [NF-13](#nf-13)–21 were added in the docs. Capacity, service levels and load tests are in [scalability](scalability.md).

| ID | Area | Requirement |
|---|---|---|
| <a id="nf-1"></a>NF-1 | Accessibility | Meets WCAG 2.2 AA: text contrast ≥ 4.5:1 and control borders ≥ 3:1 in both themes; colour never carries meaning alone |
| <a id="nf-2"></a>NF-2 | Accessibility | Touch targets ≥ 44 × 44px; every icon-only button has an accessible name; visible 2px focus ring on every control; full keyboard use; respects reduced-motion |
| <a id="nf-3"></a>NF-3 | Accessibility | Works with VoiceOver and TalkBack; status changes ("Listening…", "Reading file…", toasts) are announced |
| <a id="nf-4"></a>NF-4 | Performance | First load interactive in ≤ 3 s on a mid-range phone over 4G; repeat loads from cache in ≤ 1 s |
| <a id="nf-5"></a>NF-5 | Performance | A note of up to 10 items is processed and its result shown in ≤ 2 s (p90) when online |
| <a id="nf-6"></a>NF-6 | Offline | All lists, task edits and note capture work offline; changes queue and sync on reconnect without loss; conflicts resolve last-write-wins per field |
| <a id="nf-7"></a>NF-7 | Platform | Installable PWA (manifest, service worker, icons); supports the last two versions of Chrome, Safari (iOS 16.4+), Samsung Internet, Firefox and Edge |
| <a id="nf-8"></a>NF-8 | Layout | Fluid from 320px to 480px wide (360px reference), centred column up to 600px, `100dvh` height, safe-area insets respected; no native status bar or keyboard drawn |
| <a id="nf-9"></a>NF-9 | Privacy | Notes, attached files and tasks belong to the account holder only; files are used to extract text and are not kept after extraction; no note or task text in logs; outside services get only what [ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md) (OpenRouter) and [NC §2.4](../03-modules/NC-note-capture.md#24-file-to-note-nc-4-should) (Google Cloud Vision) allow |
| <a id="nf-10"></a>NF-10 | Security | Passwords hashed (never stored or logged in plain text); HTTPS only; sign-in lockout per [AA-3](../03-modules/AA-account-access.md#aa-3); reset links single-use and expire in 60 minutes |
| <a id="nf-11"></a>NF-11 | Reliability | No task change is lost: every applied note is stored with enough to undo it (before/after values) |
| <a id="nf-12"></a>NF-12 | Content | Follows the [theme guide](../01-product/theme-guide.md)'s voice: sentence case, 24-hour times by default (12-hour is a setting, [AP-5](../03-modules/AP-app-platform.md#ap-5)), short dates, no emoji |

## Security and privacy

### Engineering requirements (NF-13–21)

Added in the docs (not in the PRD) to make [NF-9](#nf-9) and [NF-10](#nf-10) testable. Threats and controls: [security](../07-architecture/security.md).

| ID | Requirement | Test |
|---|---|---|
| <a id="nf-13"></a>NF-13 | **Rate limits** per the table below. Exceeding one returns `429` with `Retry-After` and a copy-catalog message | SEC-10 |
| <a id="nf-14"></a>NF-14 | **Input limits** per the table below, enforced on the server (the client mirrors them for feedback) | SEC-11 |
| <a id="nf-15"></a>NF-15 | **Session** per [ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md): first-party HttpOnly cookie, CSRF token, regenerated on sign-in, other sessions ended on password change | SEC-01–04 |
| <a id="nf-16"></a>NF-16 | **Security headers** on every response: CSP with `frame-ancestors 'none'`, `object-src 'none'` and `base-uri 'self'` on pages, and `default-src 'none'` on the API (no script allow-list, see [ASVS deviation 4](../06-testing/asvs-checklist.md#deviations)), HSTS 1 year, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` allowing only the microphone on self, `frame-ancestors 'none'` | SEC-20 |
| <a id="nf-17"></a>NF-17 | **File upload pipeline:** size ≤ 5 MB, type from magic bytes (not the extension), allow-list, parsed in a sandboxed worker with a 10 s timeout and a 50 MB memory cap, extracted text ≤ 5,000 characters, the file deleted when extraction ends (success or failure), EXIF stripped before OCR except orientation | SEC-30–35 |
| <a id="nf-18"></a>NF-18 | **LLM controls** per [ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md): minimum context, schema-only output, server validation, per-user and global budgets, kill switch, no text in logs | SEC-40–44 |
| <a id="nf-19"></a>NF-19 | **Client data:** the service worker never caches authenticated API responses in the HTTP cache. Offline data lives in IndexedDB only, and sign-out wipes IndexedDB and SW data caches | SEC-50–51 |
| <a id="nf-20"></a>NF-20 | **Audit log** of security events (sign-in success/failure, lockout, reset requested/used, password changed, sign-out everywhere), with user ID, IP, user agent and time, kept 90 days. No passwords or tokens | SEC-60 |
| <a id="nf-21"></a>NF-21 | **Supply chain:** dependency audit (`composer audit`, `npm audit --omit=dev`) and secret scanning on every PR. High/critical findings block the merge | SEC-70 |

### Rate limits (NF-13)

| Scope | Limit | Key |
|---|---|---|
| Sign-in | 3 failures → 60 s lock ([AA-3](../03-modules/AA-account-access.md#aa-3)). 30 attempts / 10 min per IP. 20 failures / hour per email → 15 min lock | (email, IP), IP, email |
| Create account | 5 / hour per IP | IP |
| Password reset request | 3 / hour per email, 10 / hour per IP. Resend after 45 s | email, IP |
| Setting the new password (reset link) | 5 / min and 20 / hour per IP | IP |
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
| Open tasks per user | 5,000 | `task.limit` (far above expected use) |
| Email | 254 characters, normalised to lower case, trimmed | Field validation |
| Password | 8–128 characters | Field validation |
| Search query | 100 characters | Cut |

## Operational logging

- Server errors and slow queries (> 500 ms) go to the Laravel log, kept 14 days.
- Note processing logs duration (for [NF-5](#nf-5)), plan counts and the engine used, never text.
- There is no product analytics: Agendal is a demo, so it tracks no usage metrics ([Q8](../08-project/open-questions.md#q8)).
