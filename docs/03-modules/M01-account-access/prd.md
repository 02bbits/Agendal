# M01 Account & Access — Product Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| AA-1 | Create an account with email and password | Must | Password is at least 8 characters and differs from the email; Create account stays disabled until valid; success opens Inbox with "Welcome to Agendal. Your account is ready." |
| AA-2 | Sign in with email and password | Must | Wrong details show "Email or password is incorrect."; password has show/hide; a Remember me checkbox (on by default) keeps the session on this device |
| AA-3 | Lock sign-in after repeated failures | Must | After 3 failed attempts, a "Too many attempts" banner shows and Sign in is disabled for 60 s with a countdown |
| AA-4 | Reset a forgotten password by email | Must | The same confirmation shows whether or not the account exists; the link expires in 60 minutes; Resend unlocks after 45 s |
| AA-5 | Sign out | Must | Sign out in the Account sheet returns to Sign in |
