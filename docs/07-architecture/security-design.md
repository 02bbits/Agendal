# Security Design

Requirements: [security.md](../05-non-functional-requirements/security.md) (NF-9, NF-10) and AA-1–5.

| Threat | Control | Ref |
|---|---|---|
| Password theft | Hash with bcrypt/Argon2. Never stored or logged in plain text. ≥ 8 characters, not equal to the email | NF-10, AA-1 |
| Credential stuffing / guessing | Lockout after 3 failures for 60 s, per email and device/IP | AA-3, NF-10 |
| Account enumeration | Reset shows the same confirmation whether or not the account exists. Other users' resources return 404 | AA-4, NF-9 |
| Reset-link abuse | Token stored hashed, single use, 60 min expiry | AA-4, NF-10 |
| Eavesdropping | HTTPS only. Secure, HttpOnly session cookie | NF-10 |
| Session on shared devices | Remember me (on by default) can be turned off at sign-in or in Account | AA-2 |
| Reading another user's data | Per-user policies on every query and every plan action | NF-9 |
| Personal data in files | Extract the text, then discard the file. 5 MB limit. Allow-listed types | NC-4, NF-9 |
| Personal data in analytics | Events carry counts and categories only, never note or task text | NF-9 |
| XSS through note or task text | Rendered as text (React escaping). No raw HTML | — |
| Malicious note text (if a model is used) | The model can only return a plan. The server validates it against the user's own tasks and applies the safety rules ([ADR-001](technical-decisions/ADR-001-note-plan-contract.md)) | NU-5 |
