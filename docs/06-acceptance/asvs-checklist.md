# OWASP ASVS Checklist (L2)

The ASVS 4.0.3 Level 2 requirements that apply to Agendal, with how each is met and which test proves it. The target is L2, because the app holds personal data.

> Requirement numbers follow ASVS 4.0.3. **Check them against the published standard** before the security review. Items that don't apply (no SOAP, no GraphQL, no SAML, no payments, no file serving) are left out.

**Status:** Planned = specified in the docs and not yet built. Pass = test green in CI. Deviation = deliberately different, with the reason.

## V2 Authentication

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 2.1.1 | Passwords ≥ 12 characters | **Deviation:** the PRD sets 8 (AA-1). It is offset by the breached-password check (2.1.7) and rate limits. Decision pending: Q18 | T-AA-02 | Deviation |
| 2.1.2 | Passwords up to at least 64 characters allowed | 128 maximum (NF-14) | T-AA-03 | Planned |
| 2.1.3 | No truncation | Hashed in full. Argon2id has no 72-byte limit | T-AA-03 | Planned |
| 2.1.4 | Any printable Unicode, including spaces and emoji | No character-class rules | T-AA-03 | Planned |
| 2.1.7 | Checked against breached passwords | k-anonymity range check at sign-up and reset (ADR-007) | SEC-06 | Planned |
| 2.1.8 | Strength feedback | Rule helper text plus the breached-password check. No strength meter | T-AA-01 | Planned |
| 2.1.9 | No composition rules | Only length, and "differs from the email" | T-AA-02 | Planned |
| 2.1.12 | Show / hide password | AA-2 | T-AA-11 | Planned |
| 2.2.1 | Anti-automation against brute force and stuffing | Lockout per (email, IP), plus per-IP and per-email limits (NF-13) | SEC-05, SEC-07 | Planned |
| 2.2.3 | Notify on credential change | Email on password change and reset | T-AA-42 | Planned |
| 2.4.1 | Passwords stored with a slow adaptive hash | Argon2id (ADR-007) | SEC-03 | Planned |
| 2.5.1 | Reset secret not sent in clear by the system | The link carries a random token. No password is ever emailed | SEC-09 | Planned |
| 2.5.2 | No password hints or knowledge questions | None | — | Planned |
| 2.5.4 | No shared or default accounts | The seed account exists only in test and dev | SEC-71 (config check) | Planned |
| 2.5.6 | Reset token is random, single use and expires | 32 bytes, stored hashed, 60 min, single use (SC-05) | SEC-09 | Planned |
| 2.7.x / 2.8.x | OTP and MFA | Not in scope for the beta. Candidate for "Later" | — | N/A |

## V3 Session management

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 3.1.1 | No session token in the URL | HttpOnly cookie only (ADR-007) | SEC-01 | Planned |
| 3.2.1 | New token on authentication | Session regenerated on sign-in | SEC-04 | Planned |
| 3.2.3 | Token stored in secure browser storage | HttpOnly cookie. Nothing in localStorage | SEC-01 | Planned |
| 3.3.1 | Sign-out invalidates the session server-side | AA-5. Sign-out also wipes device data (NF-19) | SEC-50 | Planned |
| 3.3.2 | Re-authentication or idle timeout | 2 h idle without Remember me. 30 days absolute with it (ADR-007) | SEC-04 | Planned |
| 3.3.3 | Option to end all other sessions after a password change | Done automatically on change and reset | SEC-09 | Planned |
| 3.3.4 | User can see and end active sessions | Sign out everywhere (Should). A session list is "Later" | T-AA-43 | Planned |
| 3.4.1–3.4.3 | Cookie `Secure`, `HttpOnly`, `SameSite` | All three. SameSite=Lax | SEC-01 | Planned |
| 3.4.4 | `__Host-` prefix | Cookie named `__Host-agendal_session` | SEC-01 | Planned |
| 3.5.x | Token-based sessions | Not used (cookie session) | — | N/A |

## V4 Access control

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 4.1.1 | Enforced on a trusted service | Laravel policies on every route. The client hides nothing it relies on | SEC-12 | Planned |
| 4.1.3 | Least privilege | One role: owner of their own data | SEC-12 | Planned |
| 4.1.5 | Fails securely | No policy means deny | SEC-12 | Planned |
| 4.2.1 | IDOR protection | Every query scoped by `user_id`. Other users' resources return 404 ([authorization matrix](../07-architecture/threat-model.md#authorization-matrix)) | SEC-12 | Planned |
| 4.2.2 | CSRF protection | SameSite=Lax plus XSRF header (SC-09) | SEC-02 | Planned |

## V5 Validation, sanitisation and encoding

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 5.1.1 | Defence against HTTP parameter pollution | Typed request objects. Duplicate keys rejected | SEC-11 | Planned |
| 5.1.2 | Mass assignment | Explicit fillable fields. The sync field allow-list (SC-10) | SEC-15 | Planned |
| 5.1.3 | Input validated with allow-lists | Request validation per endpoint, limits per NF-14 | SEC-11 | Planned |
| 5.2.1 | Untrusted HTML sanitised | No HTML input is accepted. All text is rendered as text (SC-08) | SEC-21 | Planned |
| 5.2.7 | SVG sanitised | SVG uploads not accepted (NF-17 allow-list) | SEC-30 | Planned |
| 5.3.3 | Context-aware output encoding against XSS | React escaping. `dangerouslySetInnerHTML` banned by lint | SEC-21 | Planned |
| 5.3.4 | Parameterised queries | Eloquent / query builder only. Raw SQL banned by lint | SEC-22 | Planned |
| 5.5.2 | XML parsers safe from XXE | Word (.docx) parser runs with external entities disabled, in the sandbox | SEC-32 | Planned |

## V7 Errors and logging

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 7.1.1 | No credentials or session tokens in logs | Log redaction list. Request bodies not logged | SEC-44 | Planned |
| 7.1.2 | No other sensitive data in logs | No note or task text (NF-9, SC-21) | SEC-44 | Planned |
| 7.1.3 | Security events logged | Audit log (NF-20) | SEC-60 | Planned |
| 7.4.1 | Generic error message with an ID for support | Error shape with a copy-catalog message. 500s show `error.generic` plus a request ID | T-AP-40 | Planned |

## V8 Data protection

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 8.1.1 | Sensitive data not cached in server components | No API responses in shared caches. `Cache-Control: no-store` on `/api` | SEC-51 | Planned |
| 8.2.1 | Anti-caching headers on sensitive data | As above | SEC-51 | Planned |
| 8.2.3 | Client storage cleared after the session ends | Sign-out wipes IndexedDB and SW caches (NF-19) | SEC-50 | Planned |
| 8.3.1 | Sensitive data only in the body or headers, never in the URL | Search uses `GET ?q=`. **Deviation:** the query is personal, so it is excluded from access logs | SEC-44 | Deviation |
| 8.3.4 | Sensitive data identified and covered by a policy | [Threat model](../07-architecture/threat-model.md) assets, NF-9 | — | Planned |
| 8.3.8 | Retention policy applied | [Scalability](../05-non-functional-requirements/scalability.md) retention section | T-AP-41 | Planned |

## V9 Communications

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 9.1.1 | TLS for all connections | HTTPS only, HSTS 1 year (NF-10, NF-16) | SEC-20 | Planned |
| 9.2.x | TLS to back-end services | Providers (email, LLM, OCR, push) over TLS. The database is on a private network | SEC-72 (config check) | Planned |

## V10 Malicious code

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 10.3.2 | Integrity of third-party code | Lockfiles. Fonts are the only third-party runtime asset (CSP) | SEC-70 | Planned |

## V11 Business logic

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 11.1.1 | Steps processed in order | Note status machine. `apply` is valid only from `confirm` ([state transition](../02-domain/state-transition.md)) | T-RV-xx (M04 spec) | Planned |
| 11.1.2 | Realistic human timing | Rate limits (NF-13) | SEC-10 | Planned |
| 11.1.4 | Anti-automation against excessive calls | Rate limits, plus the LLM budget (NF-18) | SEC-10, SEC-42 | Planned |

## V12 Files and resources

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 12.1.1 | Size limit | 5 MB (NF-17) | SEC-31 | Planned |
| 12.1.2 | Compressed files checked against bombs | Decompression ratio and size caps inside the sandbox | SEC-33 | Planned |
| 12.2.1 | Content matches the expected type | Magic-byte check (NF-17) | SEC-30 | Planned |
| 12.4.1 | Untrusted files kept outside the web root | Files are never stored (SC-16) | SEC-34 | Planned |
| 12.4.2 | Files scanned for malware | **Deviation:** not stored and not served, only parsed in a sandbox, so a scan adds little | — | Deviation |

## V13 API

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 13.1.3 | No secrets in API URLs | None used | SEC-01 | Planned |
| 13.2.1 | Only intended HTTP methods allowed | Routes list explicit methods. Others return 405 | SEC-12 | Planned |
| 13.2.2 | JSON schema validation | Request validation per endpoint | SEC-11 | Planned |
| 13.2.5 | Content-Type checked | `application/json` required, except multipart on `/files/extract` | SEC-11 | Planned |

## V14 Configuration

| ASVS | Requirement (short) | How Agendal meets it | Test | Status |
|---|---|---|---|---|
| 14.2.1 | Components up to date, no known vulnerabilities | Audits in CI (NF-21) | SEC-70 | Planned |
| 14.3.2 | Debug mode off in production | `APP_DEBUG=false` checked at deploy | SEC-71 | Planned |
| 14.3.3 | Headers don't leak versions | `X-Powered-By` and `Server` versions removed | SEC-20 | Planned |
| 14.4.1–14.4.7 | Security headers (content type, CSP, nosniff, referrer, frame-ancestors) | NF-16 | SEC-20 | Planned |
| 14.5.3 | CORS allow-list | Same origin only. No CORS headers on `/api` | SEC-20 | Planned |

## Deviations to approve

1. **2.1.1 password length 8 vs 12:** Q18.
2. **8.3.1 search query in the URL:** kept for shareable, cacheable GET semantics. Excluded from access logs instead.
3. **12.4.2 malware scan:** files are never stored or served.
