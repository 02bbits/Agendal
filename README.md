# Agendal

Write a note, get organised tasks. A mobile web app (PWA) built for the VNUK *Advanced Web Development* course. Product and engineering docs are in [docs/](docs/README.md), and the build plan is in [MVP tasks](docs/08-project/tasks.md).

| Folder | What |
|---|---|
| `backend/` | Laravel 13 API at `/api/v1`, Sanctum cookie sessions ([ADR-007](docs/07-architecture/decisions/ADR-007-session-and-auth.md)) |
| `frontend/` | Next.js 16, TypeScript strict. Forwards `/api/*` and `/sanctum/*` to the backend, so the browser sees one site |
| `docker-compose.yml` | PostgreSQL 18 and Mailpit for local development |

## Prerequisites

PHP 8.4+ with `pdo_pgsql`, `intl` and `mbstring`, Composer, Node 20+, Docker.

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

Open the app at <http://localhost:3000>, not :8000. Emails such as password resets land in Mailpit at <http://localhost:8025>. API docs are generated from the code at <http://localhost:8000/docs/api> (local only). Use Chrome or Firefox locally: the session cookie is `Secure` with a `__Host-` prefix (ADR-007), and Safari rejects it over plain http.

## Time

Read the time only through the clock (ADR-006): `ClockInterface` on the server, `@/lib/clock` on the client. Tests pin it with `travelTo()` or `vi.setSystemTime()` plus a zone. A note's "now" is `ClientClock::fromWrittenAt()`: its `written_at`, clamped to server time. API calls go through `@/lib/api`, which sends `X-Timezone`.

## Checks

For IM-32, edit the [splitter scenario CSV](backend/tests/Fixtures/note-splitter-scenarios.csv) and follow the [self-test instructions](backend/tests/Fixtures/README.md). Run only those tests with `cd backend && php vendor/bin/pest tests/Unit/Services/NoteSplitterTest.php`; they require no database.

To try the application code directly, run `php artisan notes:split "your note"` from `backend/`. Dynamic scenario definitions live only in [tests/Support/NoteSplitterScenarios.php](backend/tests/Support/NoteSplitterScenarios.php); run them with `php vendor/bin/pest tests/Unit/Services/NoteSplitterDynamicTest.php`. The rules file is [backend/resources/notes/splitter-rules.csv](backend/resources/notes/splitter-rules.csv), resolved by Laravel's `resource_path('notes/splitter-rules.csv')`.

Tests run on the `agendal_test` database, created automatically with a new `db` volume. On a volume made before it existed, create it once:

```bash
docker compose exec db psql -U agendal -c 'CREATE DATABASE agendal_test OWNER agendal'
```

GitHub Actions runs the same checks on every pull request ([ci.yml](.github/workflows/ci.yml)). Run them locally first:

```bash
cd backend && ./vendor/bin/pint --test && composer analyse && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test
```
