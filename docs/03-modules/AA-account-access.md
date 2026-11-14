# AA — Account & Access

Creating an account, signing in with lockout after repeated failures, password reset by email, and signing out. Every note, task and project belongs to exactly one account.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md), [threat model](../07-architecture/security.md), [ASVS checklist](../06-testing/asvs-checklist.md)

- **Screens:** Sign in, Create account, Reset password, Account sheet ([screens and navigation](../01-product/screens.md))
- **Workflows:** [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md)

AA covers creating an account, signing in, lockout, password reset and signing out. Most of the mechanism is decided in [ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md). This module fixes the screens, flows and edge cases.

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="aa-1"></a>AA-1 | Create an account with email and password | Must | Password is at least 8 characters and differs from the email; Create account stays disabled until valid; success opens Inbox with "Welcome to Agendal. Your account is ready." |
| <a id="aa-2"></a>AA-2 | Sign in with email and password | Must | Wrong details show "Email or password is incorrect."; password has show/hide; a Remember me checkbox (on by default) keeps the session on this device |
| <a id="aa-3"></a>AA-3 | Lock sign-in after repeated failures | Must | After 3 failed attempts, a "Too many attempts" banner shows and Sign in is disabled for 60 s with a countdown |
| <a id="aa-4"></a>AA-4 | Reset a forgotten password by email | Must | The same confirmation shows whether or not the account exists; the link expires in 60 minutes; Resend unlocks after 45 s |
| <a id="aa-5"></a>AA-5 | Sign out | Must | Sign out in the Account sheet returns to Sign in |

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| First launch, signed-out deep link, session expired | Sign in, returning to the requested screen afterwards |
| "Create account" link on Sign in | Create account |
| "Forgot password" on Sign in | Reset request |
| Link in the reset email | Set new password |
| Avatar → Account sheet | Sign out, Sign out on all devices |

- As a new user, I create an account in under 30 seconds and land in my Inbox.
- As a user on my own phone, I stay signed in for weeks.
- As a user on a shared computer, I sign out and nothing of mine stays on it.
- As a user who forgot my password, I reset it from my email without contacting anyone.

## 2. Behaviour detail

### 2.1 Create account (AA-1)

- **Fields:**
  - **Email:** `type=email`, `autocomplete=email`. Trimmed and lower-cased before it's sent.
  - **Password:** `autocomplete=new-password`, with show/hide. Helper text `auth.password_rule`.
- **Create account** stays disabled until the email has a valid format and the password is 8–128 characters and differs from the email (case-insensitive) ([BR-17](../02-domain/business-rules.md#br-17)).
- **Server checks:** the same rules, the breached-password check (`auth.password_breached`), and an email already in use (`auth.email_taken`). The last one is a known enumeration point, accepted with the 5/hour per IP limit (see §9).
- **On success:**
  - The account and session are created.
  - `display_name` = the email's local part. `timezone` comes from the device ([ADR-006](../07-architecture/decisions/ADR-006-time-zones.md)).
  - A 6-digit code is emailed and Verify email opens (`/verify`, §2.8). After the code, the setup step opens (`/welcome`, §2.6). Inbox follows with the toast `auth.welcome`. The install banner logic starts (AP).
- **Desktop layout (from 1024 px, also Sign in):** two columns. Left, the brand panel in `navy`: logo, the decorative illustration, `auth.hero_title` and `auth.hero_body`. Right, the form, centred, at most 360 px wide, with `auth.sign_in_title` / `auth.sign_in_subtitle` on Sign in and `auth.create_title` / `auth.create_subtitle` on Create account. Phones keep one column.

### 2.2 Sign in (AA-2, AA-3)

- **Fields:** email and password (`current-password`), with show/hide. Remember me is ticked by default.
- **Wrong details:** `auth.invalid`, shown for both unknown email and wrong password, with equal timing ([SC-04](../07-architecture/security.md#sc-04)). The password field is cleared and focused, and the email is kept.
- **Lockout:**
  - After 3 failures for this (email, IP): the banner `auth.locked_title` with `auth.locked_body` and a live countdown. Sign in is disabled for 60 s.
  - The remaining seconds come from the server (`retry_after`), so a reload doesn't reset the countdown.
  - The other limits (per IP, per email) show the same banner ([ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md)).
- **Success:** the session ID is regenerated. The user goes to the screen they asked for before signing in, if it's a same-origin path, otherwise Inbox.
- **Two-step verification on (§2.9):** a correct password does not sign in yet. The server answers `202 {two_factor: true, email}` (the email masked, `v********@example.test`) and emails a code; the screen asks for it (`auth.two_factor_title`). The pending sign-in lasts 10 minutes (`auth.two_factor_expired`); **Use a different account** goes back to the password step.
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
   - A notice email `email.changed_subject` is sent (ASVS 2.2.3). It says what to do if the user didn't make the change.
5. **Emails:** both use the copy in the [Email section](../01-product/copy-catalog.md#email) and the Graphite mail theme, in light and dark mail clients, with no images.

### 2.4 Sign out (AA-5)

- **Unsynced changes:** if queued edits or pending notes exist, the dialog `auth.signout_unsynced_*` shows, with a red Sign out and Cancel.
- **Sign out steps:**
  1. `POST /auth/logout`. The response also expires the session cookie (`Max-Age=0`) and the remember cookie, so the browser keeps no session (#149)
  2. Wipe IndexedDB, the service-worker data caches, the draft and per-device preferences ([NF-19](../05-quality/nfr.md#nf-19)). The colour palette and page view on the page go back to the defaults, so the next account never shows the last one's look
  3. Go to Sign in
- **Offline:** the device data is still wiped at once. The server session ends when the cookie expires, or on the next request. The dialog warns that unsynced changes will be lost.
- **Sign out on all devices** (Should): ends every session, including this one.

### 2.5 Session lifetime

- **Remember me on:** 30 days from sign-in. **Off:** the browser session, plus a 2-hour idle timeout ([ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md)).
- **Expiry while using the app:** [UX-44](../01-product/ux-standards.md#ux-44). The queued data stays, tagged with the user ID, and syncs after the same user signs back in. If a *different* user signs in on that device, the old data is wiped first.

### 2.6 Setup step after sign-up (#149)

- Shown once, after the email is verified, on phone and desktop (desktop: a 480 px card in the right column of the two-column layout). No app chrome.
- **Three steps** in a stepper (`stepper.progress`): the current step shows its number and title, done steps a check; a step can only be reached once the ones before it are done. Continue and Back move between them with a slide.
  1. **Your name** (`setup.name_label`): 3–30 characters once trimmed, with no control, invisible or text-direction characters and no angle brackets (the emoji joiner is allowed), prefilled from the email (its first 30 characters). Errors: `setup.name_required`, `setup.name_too_short`, `setup.name_too_long`, `setup.name_invalid`. Settings › Account › Name follows the same rule: the counter reads n/30, and leaving the field with a name it refuses shows the error and saves nothing. Enter goes to the next step.
  2. **Dates and times.** Week starts on: Monday / Sunday. Time format: 24-hour / 12-hour, with a live example (`setup.time_example`). Time zone: taken from the device and shown with its UTC offset; `setup.time_zone_change` picks another zone, then `setup.time_zone_auto` goes back to the device's.
  3. **Security:** the two-step verification switch (§2.9), off by default.
- **Finish** saves with one `PATCH /me` (and `POST /auth/two-factor` when the switch is on) and opens Inbox with `auth.welcome`. **Skip for now** (top right, level with the logo on phones) opens Inbox and saves nothing.
- **Steady layout:** on desktop the card keeps the height of the tallest step, so it and Continue don't move between steps. On phones the title and the steps sit at a fixed height, the step grows downward, and Back / Continue stay at the bottom.

### 2.7 Change password (#149)

- Settings › Account › **Change password** opens a sub-view with a back arrow: Current password, New password, Confirm new password, each with show/hide. No Forgot password link there.
- **Live feedback** (polite, linked with `aria-describedby`): a checklist that ticks as each rule passes (`auth.rule_length`, `auth.rule_not_email`, `auth.rule_not_current`; nothing ticks while New password is empty), a 4-step strength bar with a word and the hint `auth.strength_hint`, and under Confirm `auth.password_mismatch` or `auth.password_match`. Capitals, numbers or symbols are a hint only, never a rule ([BR-17](../02-domain/business-rules.md#br-17), ASVS 2.1.9).
- **Current password on blur:** leaving the field with a value checks it with `POST /auth/check-password`. A wrong one turns the field red with `auth.current_password_wrong`; typing again clears it. Save checks it again either way.
- **Save** stays disabled until Current is filled, every rule passes and Confirm matches.
- **Server order:** the current password first (`auth.current_password_wrong`, nothing else runs), then the sign-up rules, then different from the current one (`auth.password_same_as_current`), then the match (`auth.password_mismatch`), then the breached check. Wrong current password keeps what was typed and focuses that field.
- **Success:** the pane shows `settings.password_changed_title` and `settings.password_changed_body` with a Done button back to Account (announced, focus on the heading). Every other session ends and this one stays, the notice email is sent (ASVS 2.2.3) and an audit event `password_changed` is written.
- **Limit:** only wrong current passwords count, 5 per 15 minutes per user, shared by the blur check and Save; then `429` with `Retry-After`. A correct one resets the count.

### 2.8 Verify email (#149)

- After Create account the user is signed in but unverified. `/verify` shows `auth.verify_title` and `auth.verify_body` with the email, and six code slots (`auth.verify_label`; paste and the one-time-code autofill both work). The sixth digit submits.
- **The code:** 6 digits, stored only as an HMAC, valid 10 minutes, 5 tries (the 5th wrong answers `auth.verify_too_many`; `auth.verify_expired` after 10 minutes); resend 60 s apart, 10 per 30 minutes, then 30 minutes. Each new code replaces the last.
- **A used-up code** (here and in §2.9): after 5 wrong tries (`auth.verify_too_many`) or 10 minutes (`auth.verify_expired`), the code is dead, the six slots empty and are disabled, and a red notice shows the reason with a second line (`auth.resend_wait_hint` while the wait runs, then `auth.resend_now_hint`, and Send a new code becomes a button). Sending a new code opens the slots again and shows `auth.verify_sent` with `auth.verify_sent_hint` in a green box shaped like the red one. While a full code is checked the slots are disabled (more typing can't change it), a new code empties them, and the message area keeps its height so the page doesn't move.
- **Send a new code:** 60 s after the last one (`auth.verify_resend_wait` counts down), at most 10 codes per 30 minutes; after the 10th, the next one waits 30 minutes (`429 error.rate_limited {retry_after}`, `auth.resend_limited`). `auth.verify_sent` confirms. **Use a different account** signs out and opens Sign in.
- **Accepted:** the slots fill and a check draws in, then Setup opens (§2.6). An account verified elsewhere that opens `/verify` goes to Inbox.
- **Until verified:** every page opens `/verify`, and every API call except `/me`, sign-out and the two verify endpoints answers `403 auth.email_unverified`. Accounts that existed before #149 count as verified.
- **The email** (`email.verify_*`) puts the code alone in a large monospace box, with room above and below, in light and dark mail clients.

### 2.9 Two-step verification by email (#149)

- **Where:** Settings › Account › Two-step verification (one switch, `settings.two_factor_label`) and the Security step of Setup. Off by default.
- **Turning on** is immediate (`settings.two_factor_on_toast`). **Turning off** asks for the current password in a dialog (`settings.two_factor_off_title`); a wrong one shows `auth.current_password_wrong` and counts toward the §2.7 limit.
- **Signing in with it on:** after the right password, a 6-digit code is emailed (`email.signin_*`) and the Sign in screen asks for it in the same six slots (`auth.two_factor_title`, `auth.two_factor_body` with the masked email). Same code rules as §2.8: 10 minutes, 5 tries, a new code after 60 s, 10 sends per 30 minutes then 30 minutes. Remember me applies once the code is accepted.
- **Signing in again** during the wait does not send past the 10 per 30 minutes limit or reset the 5 tries: the code already sent stays the one.
- The pending sign-in is kept in the server session only (user id, remember, expiry), never in the browser.

### 2.10 Password fields (#149)

- Every password field sets `autocapitalize=none`, `autocorrect=off`, `spellcheck=false` and `lang=en`, so phones don't change what is typed.
- **Caps Lock** on while the field has focus shows `auth.caps_lock_on` under it.
- **Keys only, in every password field** (Sign in, Create account, Reset password, Change password): a field holds only what an English keyboard types (printable ASCII, space included) and emoji (with their joiners, skin tones, flags and keycaps). A page can't switch off Vietnamese typing (Unikey, EVKey), which deletes the last letters and types an accented one, so the field undoes it and keeps the keys pressed: A then A gives `AA`, not `Â`; a, a, s gives `aas`. The password is then the same with Vietnamese typing on or off. A lone W, which Telex turns into `ư`, stays `w`. Pasted Vietnamese letters become their Telex keys too. Anything else (other scripts, a tab) is not typed, and the field shows `auth.password_keyboard_only` under it.
  - **Three layers:** the field above; the form, which refuses a new password with any other character on submit (`auth.password_accented`, "Use only English keyboard letters, numbers, symbols and emoji.", for values set without typing); and the server, which refuses it with that field error (422) whatever the client sent.
  - **Sign in** sends the keys like the other fields, so a password typed with Vietnamese typing on matches the one set with it on.

- **Strength meter:** Create account and Change password show the same four-segment bar with its word (`auth.strength_weak` to `auth.strength_strong`), linked to the field with `aria-describedby`; the word's line keeps its height, so the form doesn't move. Change password adds `auth.strength_hint` under it; Create account puts the shorter `auth.strength_hint_short` after the rule instead ("Longer, mixed passwords are stronger."). It only advises; the rules above decide.

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
| <a id="aa-e1"></a>AA-E1 | Email typed with capitals or spaces | Trimmed and lower-cased everywhere: sign-up, sign-in, reset | T-AA-101 |
| <a id="aa-e2"></a>AA-E2 | Locked on this IP | Another IP (the victim's phone on mobile data) can still sign in ([SC-03](../07-architecture/security.md#sc-03)) | T-AA-102, SEC-07 |
| <a id="aa-e3"></a>AA-E3 | Reloading during the lockout | The countdown continues from the server's `retry_after` | T-AA-103 |
| <a id="aa-e4"></a>AA-E4 | Reset requested twice | The new request replaces the old link, so only the newest link works, once. Requests within 45 s send nothing ([Laravel's reset broker](../07-architecture/data-model.md)) | T-AA-104 |
| <a id="aa-e5"></a>AA-E5 | Reset link opened on another device | Works. The other device's sessions end, and the new device is signed in | T-AA-105 |
| <a id="aa-e6"></a>AA-E6 | Password changed while another device is offline | That device gets `401` on next sync → [UX-44](../01-product/ux-standards.md#ux-44). Its queue is kept for the same user | T-AA-106 |
| <a id="aa-e7"></a>AA-E7 | A different user signs in on a device holding another user's unsynced data | That data is wiped before the new session loads. It can't sync into the wrong account | T-AA-107, SEC-52 |
| <a id="aa-e8"></a>AA-E8 | Password equal to the email with different case | Rejected (case-insensitive compare) | T-AA-108 |
| <a id="aa-e9"></a>AA-E9 | Password with spaces, emoji or 128 characters | Accepted in full, no truncation (ASVS 2.1.3, 2.1.4) | T-AA-03 |
| <a id="aa-e10"></a>AA-E10 | The breached-password service is down | Fail open: the account is created, and the failure is logged and alerted. Blocking sign-ups on a third party is worse | T-AA-110 |
| <a id="aa-e11"></a>AA-E11 | The return path after sign-in points to another site | Ignored, go to Inbox (no open redirect) | T-AA-111, SEC-24 |
| <a id="aa-e12"></a>AA-E12 | The password manager autofills both fields | The button enables on `input` events from autofill, not only on keystrokes | T-AA-112 |
| <a id="aa-e13"></a>AA-E13 | Sign up with an email that already exists | `auth.email_taken` with a Sign in link (accepted enumeration, §9) | T-AA-113 |
| <a id="aa-e14"></a>AA-E14 | An unverified account opens any page or calls the API | The page opens `/verify`; the API answers `403 auth.email_unverified` (§2.8) | `VerifyEmailTest` |
| <a id="aa-e15"></a>AA-E15 | With two-step on, the user signs in again and again to get fresh codes | No new code past 10 per 30 minutes, and the tries on the code already sent are not reset (§2.9) | `TwoFactorTest` |
| <a id="aa-e16"></a>AA-E16 | Account A picks a colour and Full width, signs out, account B signs in | The look resets on sign-out and comes from B's `/me`; A gets its look back on its next sign-in, on any device | `MeTest`, `session.test.tsx` |

## 5. Copy keys

`auth.welcome`, `auth.password_rule`, `auth.password_same_as_email`, `auth.password_breached`, `auth.email_taken`, `auth.invalid`, `auth.locked_title`, `auth.locked_body`, `auth.remember_me`, `auth.reset_sent`, `auth.reset_resend`, `auth.reset_expired`, `auth.password_changed`, `auth.session_expired`, `auth.signout_unsynced_one`, `auth.signout_unsynced_other`, `auth.signout_everywhere`, `auth.offline`, `error.rate_limited`.

## 6. Accessibility

- Every field has a visible label and the right `autocomplete` ([UX-22](../01-product/ux-standards.md#ux-22)). Show/hide is a button labelled "Show password", with `aria-pressed`. It is left out of the Tab order, so Tab goes from one field to the next; from the keyboard, Alt+F8 in the field shows or hides the password (`aria-keyshortcuts`). A11Y-60
- The Caps Lock and Vietnamese typing hints (§2.10) are polite status lines, read once when they appear.
- The code slots are one input (`autocomplete=one-time-code`, `inputmode=numeric`) named `auth.verify_label`; the count of digits entered and "Code accepted" are announced politely. The stepper is an ordered list named `stepper.progress`, the current step with `aria-current="step"`.
- The lockout banner is announced assertively once. The countdown isn't announced every second, only when Sign in is enabled again. A11Y-61
- On a failed submit, focus goes to the first invalid field, or to the error summary for `auth.invalid` ([UX-07](../01-product/ux-standards.md#ux-07)). A11Y-62

## 7. API contract

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `GET /sanctum/csrf-cookie` | — | `204`, sets `XSRF-TOKEN` | — |
| `POST /auth/register` | `{email, password, timezone}` | `201 {user}` and a session | `422` (`auth.email_taken`, `auth.password_breached`, field errors), `429` |
| `POST /auth/login` | `{email, password, remember}` | `200 {user}`, or `202 {two_factor: true, email}` when two-step is on (code emailed, §2.9) | `422 auth.invalid`, `429 auth.locked {retry_after}` |
| `POST /auth/two-factor/challenge` | `{code}` | `200 {user}` and a session | `422` (`auth.two_factor_expired`, `auth.verify_wrong`, `auth.verify_expired`, `auth.verify_too_many`), `429 {retry_after}` |
| `POST /auth/two-factor/resend` | — | `204` | `422 auth.two_factor_expired`, `429 {retry_after}` (60 s, or 30 minutes after 10 codes) |
| `POST /auth/verify-email` | `{code}` | `200 {user}` | `401`, `422` (`auth.verify_wrong`, `auth.verify_expired`, `auth.verify_too_many`) |
| `POST /auth/verify-email/resend` | — | `204` | `401`, `429 {retry_after}` (60 s, or 30 minutes after 10 codes) |
| `POST /auth/two-factor` | `{enabled, current_password?}` (the password only to turn it off) | `200 {user}` | `401`, `403 auth.email_unverified`, `422 auth.current_password_wrong`, `429` |
| `POST /auth/forgot-password` | `{email}` | `202` always | `429` |
| `POST /auth/reset-password` | `{token, email, password}` | `200 {user}` and a session | `422 auth.reset_expired`, field errors |
| `POST /auth/check-password` | `{current_password}` | `204` | `401`, `422` (`auth.current_password_wrong`), `429` |
| `POST /auth/change-password` | `{current_password, password, password_confirmation}` | `200 {user}`, other sessions ended | `401`, `422` (`auth.current_password_wrong`, field errors), `429` |
| `POST /auth/logout` | — | `204` | `401` |
| `POST /auth/logout-everywhere` | — | `204` | `401` |
| `GET /me`, `PATCH /me` | `{display_name?, theme?, theme_palette?, page_view?, timezone?, timezone_auto?, week_start?, time_format?}` | `200` (with `email_verified_at`, `two_factor_enabled`) | `401`, `422` |

## 8. Data, validation and authorization

- `users.email` is unique and lower-case. `password_hash` uses Argon2id. `password_reset_tokens` (Laravel's reset broker) holds one hashed token per email: 32 random bytes, 60 minutes, single use.
- `audit_events` records: sign-up, sign-in success and failure, lockout, reset requested and used, password changed, sign out everywhere ([NF-20](../05-quality/nfr.md#nf-20)). It stores the email's hash, never the password.
- `PATCH /me` allows only `display_name` (3–30 characters once trimmed, no control, invisible or text-direction characters, no angle brackets: §2.6), `theme`, `theme_palette` (`default`, `agendal`, `moonstone`, `tangerine`, `kale`, `blueberry`, `lavender`, `raspberry`), `page_view` (`flat`, `full`), `timezone` (a valid IANA name; it also turns `timezone_auto` off), `timezone_auto` (`true` follows the device again), `week_start` (`mon`, `sun`) and `time_format` (`24h`, `12h`). The colour palette and page view belong to the account: the server is the source, and the device keeps a copy only so `/theme.js` paints them before the first frame (#149).
- `users.email_verified_at` (null until §2.8) and `users.two_factor_enabled` (§2.9). `email_verification_codes` holds one code per (user, purpose `verify` / `sign_in`): the HMAC-SHA256 of the code, its expiry, the tries and when it was sent.

- Every auth endpoint answers a field sent as a list or object with `422`, never a server error, and caps text before hashing it (password and current password 128, email 254, reset token 255).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Credential stuffing, guessing | [SC-01](../07-architecture/security.md#sc-01), [SC-02](../07-architecture/security.md#sc-02) | SEC-05, SEC-06 |
| Locking a victim out | [SC-03](../07-architecture/security.md#sc-03) keyed by (email, IP) | SEC-07 |
| Enumeration through sign-in or reset | [SC-04](../07-architecture/security.md#sc-04) same message and timing | SEC-08 |
| Enumeration through sign-up (`auth.email_taken`) | Accepted residual risk: 5/hour per IP and the audit log. Removing it would need email verification before the account exists, which conflicts with [AA-1](#aa-1)'s "success opens Inbox" | SEC-08b (asserts the limit) |
| Reset token theft or reuse | [SC-05](../07-architecture/security.md#sc-05). Token in the fragment, removed from the URL | SEC-09 |
| Open redirect after sign-in | Same-origin paths only | SEC-24 |
| Data left on a shared device | [SC-19](../07-architecture/security.md#sc-19) wipe | SEC-50, SEC-52 |
| Guessing an email or sign-in code | 6 digits, 5 tries per code, 10 minutes, compared in constant time against an HMAC (§2.8, §2.9) | `VerifyEmailTest`, `TwoFactorTest` |
| Flooding a mailbox with codes | 60 s between sends and 10 per 30 minutes per user, also across repeated sign-ins (AA-E15) | `VerifyEmailTest`, `TwoFactorTest` |
| A session cookie left in the browser after sign-out | The sign-out response expires it (§2.4) | `LogoutTest` |

## 10. Performance and scaling

- Argon2id parameters tuned so a hash takes about 100 ms on the production CPU (it's slow on purpose). Sign-in p95 ≤ 500 ms.
- Rate-limit counters live in Laravel's cache store (the PostgreSQL `cache` table on the single server), keyed per [ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md).

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [AA-1](#aa-1) | Password ≥ 8 characters and differs from the email | T-AA-01 (client), T-AA-02 (server), T-AA-108 |
| [AA-1](#aa-1) | Create account stays disabled until valid | T-AA-04 |
| [AA-1](#aa-1) | Success opens Inbox with the welcome toast | T-AA-05 (E2E [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md)) |
| [AA-2](#aa-2) | Wrong details show "Email or password is incorrect." | T-AA-10, SEC-08 |
| [AA-2](#aa-2) | Password show/hide | T-AA-11, A11Y-60 |
| [AA-2](#aa-2) | Remember me (on by default) keeps the session on this device | T-AA-12 (30-day cookie), T-AA-13 (off → session cookie, 2 h idle) |
| [AA-3](#aa-3) | After 3 failures, "Too many attempts", Sign in disabled for 60 s with a countdown | T-AA-20, T-AA-103, SEC-05 |
| [AA-4](#aa-4) | The same confirmation whether or not the account exists | T-AA-30, SEC-08 |
| [AA-4](#aa-4) | The link expires in 60 minutes | T-AA-31 (injected clock), SEC-09 |
| [AA-4](#aa-4) | Resend unlocks after 45 s | T-AA-32 |
| [AA-5](#aa-5) | Sign out returns to Sign in | T-AA-40, T-AA-41 (device data wiped), SEC-50 |
| — | A password change or reset sends a notice email (ASVS 2.2.3) | T-AA-42 |
| — | Sign out on all devices ends every session | T-AA-43 |
| — | Edge cases [AA-E1](#aa-e1)–[AA-E13](#aa-e13) | T-AA-101–113 |
| — | Accessibility | A11Y-60–62 |
