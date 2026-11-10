# Agendal

Write a note, get organised tasks. A mobile web app (PWA) built for the VNUK *Advanced Web Development* course. Product and engineering docs are in [docs/](docs/README.md), and the build plan is in [MVP tasks](docs/08-project/tasks.md).

| Folder | What |
|---|---|
| `backend/` | Laravel 13 API at `/api/v1`, Sanctum cookie sessions ([ADR-007](docs/07-architecture/decisions/ADR-007-session-and-auth.md)) |
| `frontend/` | Next.js 16, TypeScript strict. Forwards `/api/*` and `/sanctum/*` to the backend, so the browser sees one site |
| `docker-compose.yml` | The whole stack: PostgreSQL 18, Mailpit, the API, a queue worker, the Next.js dev server and an opt-in production build (`web-prod`) |

## Run it

Needs only Docker.

```bash
docker compose up        # app on http://localhost:3000, API on :8000
```

The first start installs Composer and npm packages, creates `backend/.env` with an app key, then migrates and seeds (demo account: example@gmail.com / password). Every start migrates, so pulling new migrations needs no extra step. Code is mounted from the host and reloads on save. After changing `package.json`, restart `web` (`docker compose restart web`).

The service worker runs only in a production build. To check it, start one next to the dev server: `docker compose --profile prod up -d web-prod` serves it on <http://localhost:3001> (the first build takes a minute or two). Restart `web-prod` to get a new build, for example to see the update toast. Its worker and caches belong to :3001 only, so the dev app on :3000 stays uncached; clear the site data in DevTools when you're done.

Run commands inside the containers, for example `docker compose exec api php artisan test` or `docker compose exec web npm test`. The API container runs as UID 1000 by default; if yours differs, `export UID GID` first.

### Without Docker for the app

PHP 8.4+ with `pdo_pgsql`, `intl` and `mbstring`, Composer, Node 20+. Start only the services with `docker compose up -d db mail`, set up once with `cd backend && composer setup && php artisan db:seed` and `cd frontend && npm install && cp .env.example .env.local`, then run `composer run dev` in `backend/` and `npm run dev` in `frontend/`.

Open the app at <http://localhost:3000>, not :8000. Emails such as password resets land in Mailpit at <http://localhost:8025>. API docs are generated from the code at <http://localhost:8000/docs/api> (local only). Use Chrome or Firefox locally: the session cookie is `Secure` with a `__Host-` prefix (ADR-007), and Safari rejects it over plain http.

## Time

Read the time only through the clock (ADR-006): `ClockInterface` on the server, `@/lib/clock` on the client. Tests pin it with `travelTo()` or `vi.setSystemTime()` plus a zone. A note's "now" is `ClientClock::fromWrittenAt()`: its `written_at`, clamped to server time. API calls go through `@/lib/api`, which sends `X-Timezone`.

## Checks

For IM-32, edit the [splitter scenario CSV](backend/tests/Fixtures/note-splitter-scenarios.csv) and follow the [self-test instructions](backend/tests/Fixtures/README.md). Run only those tests with `cd backend && php vendor/bin/pest tests/Unit/Services/NoteSplitterTest.php`; they require no database.

Dynamic scenario definitions live only in [tests/Support/NoteSplitterScenarios.php](backend/tests/Support/NoteSplitterScenarios.php); run them from `backend/` with `php vendor/bin/pest tests/Unit/Services/NoteSplitterDynamicTest.php`. The rules file is [backend/resources/notes/note-rules.csv](backend/resources/notes/note-rules.csv), shared by the splitter and the field extractor; its path and the note limits are set in [backend/config/notes.php](backend/config/notes.php).

Tests run on the `agendal_test` database, created automatically with a new `db` volume. On a volume made before it existed, create it once:

```bash
docker compose exec db psql -U agendal -c 'CREATE DATABASE agendal_test OWNER agendal'
```

GitHub Actions runs the same checks on every pull request ([ci.yml](.github/workflows/ci.yml)). Run them locally first:

```bash
cd backend && ./vendor/bin/pint --test && composer analyse && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test
```
