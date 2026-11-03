# Agendal

Write a note, get organised tasks. A mobile web app (PWA) built for the VNUK *Advanced Web Development* course. Product and engineering docs are in [docs/](docs/README.md), and the build plan is in [MVP tasks](docs/08-project/tasks.md).

| Folder | What |
|---|---|
| `backend/` | Laravel 13 API at `/api/v1`, Sanctum cookie sessions ([ADR-007](docs/07-architecture/decisions/ADR-007-session-and-auth.md)) |
| `frontend/` | Next.js 16, TypeScript strict. Forwards `/api/*` and `/sanctum/*` to the backend, so the browser sees one site |
| `docker-compose.yml` | The whole stack: PostgreSQL 18, Mailpit, the API, a queue worker and the Next.js dev server |

## Run it

Needs only Docker.

```bash
docker compose up        # app on http://localhost:3000, API on :8000
```

The first start installs Composer and npm packages, creates `backend/.env` with an app key, then migrates and seeds (demo account: example@gmail.com / password). Every start migrates, so pulling new migrations needs no extra step. Code is mounted from the host and reloads on save. After changing `package.json`, restart `web` (`docker compose restart web`).

Run commands inside the containers, for example `docker compose exec api php artisan test` or `docker compose exec web npm test`. The API container runs as UID 1000 by default; if yours differs, `export UID GID` first.

### NVIDIA fallback for team testing (IM-38)

The main app and manual preview both support the NVIDIA hosted API; the model runs remotely, with no local GPU required. Copy `backend/.env.example` to `backend/.env` on a fresh checkout (keep an existing `.env` and update the entries below instead). Add your own NVIDIA API key and enable fallback:

```dotenv
NOTE_LLM_ENABLED=true
NOTE_LLM_PROVIDER=nvidia
NVIDIA_API_KEY=your_key_here
NOTE_LLM_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
NOTE_LLM_TIMEOUT_SECONDS=20
NOTE_LLM_PROMPT_VERSION=note-plan-v6
```

The example already includes the provider, model, timeout and prompt. Never commit `.env` or share a key in the PR. `OPENROUTER_API_KEY` is not needed for NVIDIA. Requests go to `https://integrate.api.nvidia.com/v1/chat/completions`; thinking is disabled. `NOTE_LLM_URL` optionally overrides the endpoint. NVIDIA usage is subject to your account's quota and data handling terms; the OpenRouter data-collection routing option does not apply to NVIDIA direct.

Start with `docker compose up -d`, then wait for API health before signing in:

```bash
docker compose ps
docker compose logs -f api web
```

The first boot can take several minutes to install dependencies. When `api` is healthy and Next.js reports ready, open http://localhost:3000 and sign in with `example@gmail.com` / `password`. If changing `.env` while the app is already running, run `docker compose exec api php artisan config:clear` and `docker compose restart api queue`. The 20-second timeout is a manual-testing setting, not evidence of meeting the production latency target. Calls are capped at 20 per user per day by default.

Keep `NEXT_PUBLIC_NOTES_MOCK` unset or `0` in `frontend/.env.local`; setting it to `1` uses fixture results instead of calling the note API. Known test limitations, including a Vietnamese multi-clause scheduling failure and the missing save-note-only UI flow, are recorded in [manual note cases](backend/tests/Manual/note-cases.md#giới-hạn-còn-mở-khi-test-nvidia-2026-11-03).

For the standalone preview, without database writes, run this from `backend/` after `composer install`:

```bash
php -S localhost:8091 tests/Manual/try.php
```

Open http://localhost:8091, choose **Rules + LLM**, **NVIDIA · Nemotron Super**, and a 20-second timeout. Each submit shows the final plan, the original rules preview, field sources and HTTP diagnostics. The preview isolates app budgets, but still consumes provider quota. The standalone server is local-only and is not a deployment entry point.

To use OpenRouter instead, set `NOTE_LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, a compatible `NOTE_LLM_MODEL` and your desired timeout; clear config and restart the API/queue. Installations without `NOTE_LLM_PROVIDER` retain OpenRouter as the default. To turn fallback off, set `NOTE_LLM_ENABLED=false`; uncertain writes wait for clarification rather than applying provisional results.

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
