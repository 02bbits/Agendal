# M01 Account & Access — Spec

**Status:** Ready (approved 2026-10-26) · **Requirements:** [prd.md](prd.md) · **Depends on:** [ADR-007](../../07-architecture/technical-decisions/ADR-007-session-and-auth.md), [threat model](../../07-architecture/threat-model.md), [ASVS checklist](../../06-acceptance/asvs-checklist.md)

M01 covers creating an account, signing in, lockout, password reset and signing out. Most of the mechanism is decided in ADR-007. This spec fixes the screens, flows and edge cases.

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| First launch, signed-out deep link, session expired | Sign in, returning to the requested screen afterwards |
| "Create account" link on Sign in | Create account |
| "Forgot password" on Sign in | Reset request |
| Link in the reset email | Set new password |
| Avatar → Account sheet | Sign out, Sign out on all devices |

- As a new student, I create an account in under 30 seconds and land in my Inbox.
- As a student on my own phone, I stay signed in for weeks.
- As a student who used a library computer, I sign out and nothing of mine stays on it.
- As a student who forgot my password, I reset it from my email without contacting anyone.

## 2. Behaviour detail

### 2.1 Create account (AA-1)

- **Fields:**
  - **Email:** `type=email`, `autocomplete=email`. Trimmed and lower-cased before it's sent.
  - **Password:** `autocomplete=new-password`, with show/hide. Helper text `auth.password_rule`.
- **Create account** stays disabled until the email has a valid format and the password is 8–128 characters and differs from the email (case-insensitive) (BR-17).
- **Server checks:** the same rules, the breached-password check (`auth.password_breached`), and an email already in use (`auth.email_taken`). The last one is a known enumeration point, accepted with the 5/hour per IP limit (see §9).
- **On success:**
  - The account and session are created.
  - `display_name` = the email's local part. `timezone` comes from the device (ADR-006).
  - Inbox opens with the toast `auth.welcome`. The install banner logic starts (M08).

### 2.2 Sign in (AA-2, AA-3)

- **Fields:** email and password (`current-password`), with show/hide. Remember me is ticked by default.
- **Wrong details:** `auth.invalid`, shown for both unknown email and wrong password, with equal timing (SC-04). The password field is cleared and focused, and the email is kept.
- **Lockout:**
  - After 3 failures for this (email, IP): the banner `auth.locked_title` with `auth.locked_body` and a live countdown. Sign in is disabled for 60 s.
  - The remaining seconds come from the server (`retry_after`), so a reload doesn't reset the countdown.
  - The other limits (per IP, per email) show the same banner (ADR-007).
- **Success:** the session ID is regenerated. The student goes to the screen they asked for before signing in, if it's a same-origin path, otherwise Inbox.
- **Already signed in:** visiting Sign in redirects to Inbox.

### 2.3 Reset password (AA-4)

1. **Request:** enter an email, then always see `auth.reset_sent`. Resend unlocks after 45 s, with a countdown.
2. **Email:** the link is `https://…/reset#token=…` (the token is in the fragment, so it never reaches server logs or a `Referer`). It expires in 60 minutes and works once.
3. **Set new password:**
   - The page reads the token, then removes it from the address bar with `history.replaceState`.
   - It shows the new-password field with show/hide and the same rules as sign-up, including the breached check.
   - An expired or used token shows `auth.reset_expired`, with a link to request a new one.
4. **Success:**
   - Every other session ends.
   - This device is signed in, and the toast `auth.password_changed` shows.
   - A notice email "Your password was changed" is sent (ASVS 2.2.3).

### 2.4 Sign out (AA-5)

- **Unsynced changes:** if queued edits or pending notes exist, the dialog `auth.signout_unsynced_*` shows, with a red Sign out and Cancel.
- **Sign out steps:**
  1. `POST /auth/logout`
  2. Wipe IndexedDB, the service-worker data caches, the draft and per-device preferences (NF-19)
  3. Go to Sign in
- **Offline:** the device data is still wiped at once. The server session ends when the cookie expires, or on the next request. The dialog warns that unsynced changes will be lost.
- **Sign out on all devices** (Should): ends every session, including this one.

### 2.5 Session lifetime

- **Remember me on:** a rolling 30 days. **Off:** the browser session, plus a 2-hour idle timeout (ADR-007).
- **Expiry while using the app:** UX-44. The queued data stays, tagged with the user ID, and syncs after the same user signs back in. If a *different* user signs in on that device, the old data is wiped first.

## 3. State matrix

| Screen | Empty | Busy | Success | Error | Locked | Offline |
|---|---|---|---|---|---|---|
| Create account | Button disabled | Busy button | Inbox with welcome toast | Field errors. `429` → `error.rate_limited` | — | Button disabled, `auth.offline` |
| Sign in | Button disabled until both fields are filled | Busy button | Return path, or Inbox | `auth.invalid` | Banner with countdown, button disabled | `auth.offline` |
| Reset request | Button disabled | Busy | `auth.reset_sent` and the Resend countdown | `429` | — | `auth.offline` |
| Set new password | — | Busy | Signed in, toast | Field errors. `auth.reset_expired` | — | `auth.offline` |
| Sign out | — | Busy | Sign in | Server unreachable → data wiped anyway | — | Wiped. Dialog warns about unsynced changes |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| E1 | Email typed with capitals or spaces | Trimmed and lower-cased everywhere: sign-up, sign-in, reset | T-AA-101 |
| E2 | Locked on this IP | Another IP (the victim's phone on mobile data) can still sign in (SC-03) | T-AA-102, SEC-07 |
| E3 | Reloading during the lockout | The countdown continues from the server's `retry_after` | T-AA-103 |
| E4 | Reset requested twice | Both links work until one is used. Using one invalidates every outstanding token | T-AA-104 |
| E5 | Reset link opened on another device | Works. The other device's sessions end, and the new device is signed in | T-AA-105 |
| E6 | Password changed while another device is offline | That device gets `401` on next sync → UX-44. Its queue is kept for the same user | T-AA-106 |
| E7 | A different user signs in on a device holding another user's unsynced data | That data is wiped before the new session loads. It can't sync into the wrong account | T-AA-107, SEC-52 |
| E8 | Password equal to the email with different case | Rejected (case-insensitive compare) | T-AA-108 |
| E9 | Password with spaces, emoji or 128 characters | Accepted in full, no truncation (ASVS 2.1.3, 2.1.4) | T-AA-03 |
| E10 | The breached-password service is down | Fail open: the account is created, and the failure is logged and alerted. Blocking sign-ups on a third party is worse | T-AA-110 |
| E11 | The return path after sign-in points to another site | Ignored, go to Inbox (no open redirect) | T-AA-111, SEC-24 |
| E12 | The password manager autofills both fields | The button enables on `input` events from autofill, not only on keystrokes | T-AA-112 |
| E13 | Sign up with an email that already exists | `auth.email_taken` with a Sign in link (accepted enumeration, §9) | T-AA-113 |

## 5. Copy keys

`auth.welcome`, `auth.password_rule`, `auth.password_same_as_email`, `auth.password_breached`, `auth.email_taken`, `auth.invalid`, `auth.locked_title`, `auth.locked_body`, `auth.remember_me`, `auth.reset_sent`, `auth.reset_resend`, `auth.reset_expired`, `auth.password_changed`, `auth.session_expired`, `auth.signout_unsynced_one`, `auth.signout_unsynced_other`, `auth.signout_everywhere`, `auth.offline`, `error.rate_limited`.

## 6. Accessibility

- Every field has a visible label and the right `autocomplete` (UX-22). Show/hide is a button labelled "Show password", with `aria-pressed`. A11Y-60
- The lockout banner is announced assertively once. The countdown isn't announced every second, only when Sign in is enabled again. A11Y-61
- On a failed submit, focus goes to the first invalid field, or to the error summary for `auth.invalid` (UX-07). A11Y-62

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /sanctum/csrf-cookie` | — | `204`, sets `XSRF-TOKEN` | — |
| `POST /auth/register` | `{email, password, timezone}` | `201 {user}` and a session | `422` (`auth.email_taken`, `auth.password_breached`, field errors), `429` |
| `POST /auth/login` | `{email, password, remember}` | `200 {user}` | `422 auth.invalid`, `429 auth.locked {retry_after}` |
| `POST /auth/forgot-password` | `{email}` | `202` always | `429` |
| `POST /auth/reset-password` | `{token, email, password}` | `200 {user}` and a session | `422 auth.reset_expired`, field errors |
| `POST /auth/logout` | — | `204` | `401` |
| `POST /auth/logout-everywhere` | — | `204` | `401` |
| `GET /me`, `PATCH /me` | `{display_name?, theme?, timezone?}` | `200` | `401`, `422` |

## 8. Data, validation and authorization

- `users.email` is unique and lower-case. `password_hash` uses Argon2id. `password_resets.token_hash` holds a SHA-256 of a 32-byte token.
- `audit_events` records: sign-up, sign-in success and failure, lockout, reset requested and used, password changed, sign out everywhere (NF-20). It stores the email's hash, never the password.
- `PATCH /me` allows only `display_name` (1–60 characters), `theme` and `timezone` (a valid IANA name).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Credential stuffing, guessing | SC-01, SC-02 | SEC-05, SEC-06 |
| Locking a victim out | SC-03 keyed by (email, IP) | SEC-07 |
| Enumeration through sign-in or reset | SC-04 same message and timing | SEC-08 |
| Enumeration through sign-up (`auth.email_taken`) | Accepted residual risk: 5/hour per IP and the audit log. Removing it would need email verification before the account exists, which conflicts with AA-1's "success opens Inbox" | SEC-08b (asserts the limit) |
| Reset token theft or reuse | SC-05. Token in the fragment, removed from the URL | SEC-09 |
| Open redirect after sign-in | Same-origin paths only | SEC-24 |
| Data left on a shared device | SC-19 wipe | SEC-50, SEC-52 |

## 10. Performance and scaling

- Argon2id parameters tuned so a hash takes about 100 ms on the production CPU (it's slow on purpose). Sign-in p95 ≤ 500 ms.
- Rate-limit counters live in Redis (or the cache store), keyed per ADR-007.

## 11. Analytics

| Event | Properties | Feeds |
|---|---|---|
| `account_created` | — | Funnel |
| `sign_in` | result (success, invalid, locked), remember | Auth health |
| `password_reset` | step (requested, completed) | Auth health |
| `sign_out` | unsynced changes (bool), everywhere | — |

No emails go into analytics.

## 12. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| AA-1 | Password ≥ 8 characters and differs from the email | T-AA-01 (client), T-AA-02 (server), T-AA-108 |
| AA-1 | Create account stays disabled until valid | T-AA-04 |
| AA-1 | Success opens Inbox with the welcome toast | T-AA-05 (E2E WF-07) |
| AA-2 | Wrong details show "Email or password is incorrect." | T-AA-10, SEC-08 |
| AA-2 | Password show/hide | T-AA-11, A11Y-60 |
| AA-2 | Remember me (on by default) keeps the session on this device | T-AA-12 (30-day cookie), T-AA-13 (off → session cookie, 2 h idle) |
| AA-3 | After 3 failures, "Too many attempts", Sign in disabled for 60 s with a countdown | T-AA-20, T-AA-103, SEC-05 |
| AA-4 | The same confirmation whether or not the account exists | T-AA-30, SEC-08 |
| AA-4 | The link expires in 60 minutes | T-AA-31 (injected clock), SEC-09 |
| AA-4 | Resend unlocks after 45 s | T-AA-32 |
| AA-5 | Sign out returns to Sign in | T-AA-40, T-AA-41 (device data wiped), SEC-50 |
| — | A password change or reset sends a notice email (ASVS 2.2.3) | T-AA-42 |
| — | Sign out on all devices ends every session | T-AA-43 |
| — | Edge cases E1–E13 | T-AA-101–113 |
| — | Accessibility | A11Y-60–62 |
