# Deployment

No deployment NFRs are numbered yet. Below is what the other requirements imply. Hosting is an [open question](../08-project/open-questions.md).

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| Development | Local work | Telescope enabled (NFR-27). Mocked AI provider for tests (NFR-25) |
| Staging | Pre-release checks | Telescope enabled. Assistant accuracy test set runs here (NFR-15) |
| Production | Live | Telescope disabled. HTTPS required (service worker and push) |

## Runtime processes

- Next.js server (or static/edge hosting for the frontend)
- Laravel API (PHP-FPM / Octane)
- **Queue worker**, always on (NFR-5)
- **Scheduler**, cron `* * * * * php artisan schedule:run` ([ADR-003](../07-architecture/technical-decisions/ADR-003-notification-processing.md))
- Relational database and cache

## Delivery

- GitHub Actions runs lint, type-check, and tests on every pull request (NFR-25).
- Secrets (AI, speech, push VAPID keys, mail) live only in server `.env` / CI secrets. Never commit them (NFR-12).
- The AI model is set in `.env`. Prompts are versioned in the repo (NFR-25).
- Monitoring alerts: CPU > 80% for 5 min, disk > 90% (NFR-27).
