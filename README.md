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

The clock belongs to each application, with no separate `packages/clock` install:

- Frontend: import `Clock`, `SystemClock` and the pure time/reminder helpers from `@/lib/clock`. Client components use `useClock` from `@/lib/clock/ClockProvider`; the root layout supplies the provider. Tests import `FakeClock` from `frontend/tests/support/FakeClock.ts` and pass `<ClockProvider clock={new FakeClock(pinnedInstant)}>`. Pass an explicit IANA zone to date calculations.
- Backend: inject `App\Services\Clock\ClockInterface`; The existing `AppServiceProvider` binds it to a singleton `SystemClock`. Tests can replace it with `Tests\Support\FrozenClock` using `$this->app->instance(ClockInterface::class, $clock)`. `WallTime::toUtc()` resolves floating times, and `ReminderCalculator::compute()` calculates UTC reminders independently of the clock.
- The clock is registered in each app. Reminder helpers are covered by the normal test suites; their production callers belong to the task/reminder features, which are not implemented on this branch.
- Both implementations follow [ADR-006](docs/07-architecture/decisions/ADR-006-time-zones.md): first occurrence for a repeated minute, next valid minute for a skipped minute, and 09:00 for reminders without a start time. Pin both time and zone in date tests.

### Running checks

Tests run on the `agendal_test` database, created automatically with a new `db` volume. On a volume made before it existed, create it once:

```bash
docker compose exec db psql -U agendal -c 'CREATE DATABASE agendal_test OWNER agendal'
```


```bash
cd backend && ./vendor/bin/pint --test && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck
```
