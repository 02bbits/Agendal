# Security

Design detail: [../07-architecture/security-design.md](../07-architecture/security-design.md)

| ID | Name | Description |
|---|---|---|
| NFR-6 | Password storage | Passwords are hashed with bcrypt or Argon2 (Hash::make) and must be at least 8 characters. |
| NFR-7 | API security | The API is protected by Laravel Sanctum tokens with scoped permissions. Tokens are revoked on logout and on password reset. |
| NFR-8 | Injection & XSS prevention | Eloquent and query binding are used against SQL injection. React escapes user data by default; dangerouslySetInnerHTML is never used with user or AI-generated content, and assistant replies are rendered as plain text or sanitised Markdown. |
| NFR-9 | Authentication & session | Login returns a result (success or error) within 2 seconds. Sessions expire after 120 minutes of inactivity unless “Remember me” is selected. The session ID is regenerated after login to prevent session fixation. |
| NFR-10 | Rate limiting | Login and password reset: max 5 attempts per minute per email + IP. API: max 60 requests per minute per token. Assistant: max 20 messages per minute and 200 per day per user. Exceeding a limit returns HTTP 429 with a Retry-After header. |
| NFR-11 | Authorization | Each user can only view, edit, or delete their own tasks, projects, and conversation history (Laravel Policies). Unauthorized access returns 403; a non-existent resource returns 404. Every change the assistant makes passes through the same Policies as a manual change. |
| NFR-12 | AI data privacy | Only the data a request needs (the message, the relevant tasks, the user’s time zone) is sent to the AI provider. The provider is configured not to retain data or use it for training. AI and speech API keys are stored in .env on the server, never sent to the browser or committed to GitHub. Voice recordings are deleted after transcription. |
| NFR-13 | Prompt-injection protection | The assistant can change data only through a fixed set of server-side actions (create, update, complete, delete, split, schedule task). Every action is validated server-side (dates, priority values, ownership) before it is applied. Task text is treated as data, never as instructions. |
