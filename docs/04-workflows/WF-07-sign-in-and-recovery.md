# WF-07 — Sign In and Recovery

**Trigger:** First launch, or after signing out.

## Main flow

1. The student enters an email and a password (with show/hide). Remember me is on by default (AA-2).
2. Correct details open Inbox. After the first sign-in, the Install banner shows once (AP-1).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 1 | Wrong details | "Email or password is incorrect." |
| 1 | 3 failed attempts | A "Too many attempts" banner shows. Sign in is disabled for 60 s with a countdown (AA-3) |
| 1 | Forgot password | Enter an email. The same confirmation shows whether or not the account exists. The link expires in 60 minutes. Resend unlocks after 45 s (AA-4) |
| — | No account | Create account: password ≥ 8 characters and different from the email. The button stays disabled until valid. Success opens Inbox with "Welcome to Agendal. Your account is ready." (AA-1) |
| — | Sign out | From the Account sheet. Returns to Sign in (AA-5) |
