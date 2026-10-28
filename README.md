# Agendal

Write a note, get organised tasks. A mobile web app (PWA) built for the VNUK *Advanced Web Development* course. Product and engineering docs are in [docs/](docs/README.md), and the build plan is in [MVP tasks](docs/08-project/tasks.md).

| Folder | What |
|---|---|
| `backend/` | Laravel 13 API at `/api/v1`, Sanctum cookie sessions ([ADR-007](docs/07-architecture/decisions/ADR-007-session-and-auth.md)) |
| `frontend/` | Next.js 16, TypeScript strict. Forwards `/api/*` and `/sanctum/*` to the backend, so the browser sees one site |
| `docker-compose.yml` | PostgreSQL 18 and Mailpit for local development |

## Prerequisites

PHP 8.3+ with `pdo_pgsql`, Composer, Node 20+, Docker.

## First run

```bash
docker compose up -d

cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed       # demo account: example@gmail.com / password

cd ../frontend
npm install
cp .env.example .env.local
```

## Every day

```bash
docker compose up -d
cd backend && composer run dev    # API on :8000, plus queue worker and logs
cd frontend && npm run dev        # app on http://localhost:3000
```

Open the app at <http://localhost:3000>, not :8000. Emails such as password resets land in Mailpit at <http://localhost:8025>.

## Checks

### Clock and time zones (IM-05)

This branch implements the server-side clock and timezone handling. There is no standalone clock package or frontend clock implementation.

- Inject `App\Services\Clock\ClockInterface`; the existing `AppServiceProvider` binds it to a singleton `SystemClock`. Tests replace it with `Tests\Support\FrozenClock`. `WallTime::toUtc()` resolves floating local times, and `ReminderCalculator::compute()` produces UTC reminders. `ClientClock::fromWrittenAt()` is the client's "now" for a note: `written_at` (ISO 8601 with an offset) clamped to server time + 5 min, and older than 30 days → server time.
- Clients supply a valid IANA zone in `X-Timezone`, for example `Asia/Ho_Chi_Minh`. Laravel's API middleware provides the effective zone as the request's `timezone` attribute. Missing or invalid headers use the signed-in user's stored zone, or UTC for a guest.
- Changing the signed-in user's zone updates their stored timezone and recalculates active scheduled reminders in one transaction. Floating task dates and times stay unchanged. Completed/deleted tasks are excluded; their owning features must recalculate reminders when restoring or reopening them.
- [ADR-006](docs/07-architecture/decisions/ADR-006-time-zones.md) resolves repeated minutes to the first occurrence and skipped minutes to the next valid minute. Date-only reminders use 09:00. Date tests pin time and timezone.
- IM-05 supplies time calculations and server-side timezone handling. Notification delivery is the separate TK-6 feature. Signup and note submission can consume the validated request timezone; note capture/replay must retain the original `written_at` and `timezone` values. Those feature flows are implemented in their owning tasks.

Run the clock and timezone tests from `backend/`:

```bash
php vendor/bin/pest tests/Unit/Services/ClockTest.php tests/Feature/ClockBindingTest.php tests/Feature/TimezoneTest.php
```

### Running checks

Tests run on the `agendal_test` database, created automatically with a new `db` volume. On a volume made before it existed, create it once:

```bash
docker compose exec db psql -U agendal -c 'CREATE DATABASE agendal_test OWNER agendal'
```

GitHub Actions runs the same checks on every pull request ([ci.yml](.github/workflows/ci.yml)). Run them locally first:

```bash
cd backend && ./vendor/bin/pint --test && composer analyse && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test
```
