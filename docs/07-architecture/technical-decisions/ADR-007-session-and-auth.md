# ADR-007 — Session and Authentication Model

**Status:** Proposed

## Context
AA-1–5 and NF-10 set the visible behaviour. They don't set the session mechanism, CSRF defence, expiry, how lockout is keyed, or what happens to offline data. A PWA on shared phones makes the last one a privacy issue.

## Decision
- **First-party cookie session** (Laravel Sanctum SPA mode). The app and API share one registrable domain. There are no bearer tokens in JavaScript-readable storage.
- **Cookie flags:** `Secure`, `HttpOnly`, `SameSite=Lax`. CSRF uses the `XSRF-TOKEN` cookie and an `X-XSRF-TOKEN` header on every state-changing request.
- **Session ID** is regenerated on sign-in. A password reset or change ends every other session.
- **Expiry.** With *Remember me* (default on): a 30-day rolling remember cookie. Without it: a browser-session cookie with a 2-hour idle timeout.
- **Lockout (AA-3).** 3 failures per **(email, IP)** → 60 s lock with a countdown. Anti-abuse limits that don't reveal account existence:
  - 30 attempts per IP per 10 min, across all emails
  - 20 failures per email per hour, across IPs, which triggers a 15-min lock
  - The message is identical in every case, so attackers can't tell which limit fired, and a victim can still sign in from their own IP.
- **Passwords:** Argon2id. ≥ 8 characters, not equal to the email, and rejected if found in a breached-password list (k-anonymity check). The minimum is pending Q18.
- **Reset tokens:** 32 random bytes, stored hashed, single use, 60 min. The confirmation is the same whether or not the account exists. Resend after 45 s.
- **Sign out:** ends the session server-side, then **wipes IndexedDB and the service-worker data caches** on the device. If changes are still unsynced, it first asks "You have N changes not saved yet. Sign out anyway?".
- **Session expired while offline:** the data stays on the device, tagged with the user ID. The edit queue syncs only after that same user signs in again.

## Consequences
- XSS can't steal a session token. CSRF is blocked by SameSite plus the XSRF header.
- An attacker can't lock a victim out from another IP.
- Shared devices keep no data after sign-out.
