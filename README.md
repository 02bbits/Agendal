# Agendal

**Write a note, get organised tasks.** Agendal is a phone-first web app (PWA): you write whatever is on your mind in one note, and it becomes dated, organised tasks that you review before anything changes and can undo afterwards. It is built by a student team for the VNUK _Advanced Web Development_ course.

> _"sql quiz monday 9am, email the group tonight, buy printer ink tomorrow"_
> becomes three tasks: **SQL quiz** (Monday 09:00), **Email the group** (today 20:00) and **Buy printer ink** (tomorrow).

Notes can be in English or Vietnamese (with diacritics); the interface is in English. The full product and engineering spec is in [docs/](docs/README.md); [docs/SUMMARY.md](docs/SUMMARY.md) is the whole spec in one read.

## For reviewers: try it in 5 minutes

The app is not deployed yet (IM-65), so it runs locally. You need only [Docker](https://www.docker.com/).

```bash
git clone https://github.com/02bbits/Agendal.git
cd Agendal
docker compose up
```

The first start takes a few minutes (it installs packages, migrates and seeds the database). Then:

1. Open <http://localhost:3000> in **Chrome or Firefox**. Safari rejects the secure session cookie over plain `http://localhost`.
2. Sign in with the demo account **example@gmail.com** / **password**, or create your own account. Emails (for example a password reset) arrive in Mailpit at <http://localhost:8025>.

### What to try

| Area | Try this |
|---|---|
| **Notes → tasks** | Write `sql quiz monday 9am, email the group tonight, buy printer ink tomorrow`. *Check this first* lists every change; edit or untick one, then **Apply**. The toast's **Undo all** reverses the whole note |
| **Vietnamese** | `mai 9h họp nhóm, nộp báo cáo HCI thứ 2`, then `dời họp nhóm sang thứ 3` |
| **Commands** | After the first note, write `move sql quiz to friday` or `done buy printer ink`: the note changes existing tasks instead of creating new ones |
| **Inbox** | Overdue (in red) before Today, a progress summary, *No date* and *Completed* sections. Tick a task to complete it, with Undo |
| **Upcoming** | A sticky week bar, List (two weeks) and Board (one week) views, and the All / Scheduled / Due only filters. A task shows on its start day and, as a dashed card, on its due day |
| **Tasks by hand** | The **+** button: start and due dates and times, priority, reminder, repeats (including custom rules), project and notes |
| **Projects** | Create, rename and delete a project; each has a progress bar |
| **Search** | `Ctrl+K` on desktop: tasks, projects and notes, with or without Vietnamese accents |
| **Notes tab** | Every saved note with its status (All / Accepted / Pending); open one to edit it and re-plan its tasks |
| **Settings** | Eight theme palettes, light and dark, week start, 12/24-hour time, page view, sidebar order |
| **Phone layout** | Narrow the window (or use DevTools' device mode): a tab bar replaces the sidebar, and details open full screen |
| **Offline** | DevTools → Network → Offline in the production build (below): the lists keep working and changes sync when you are back online |

The service worker and install only run in a production build: `docker compose --profile prod up -d web-prod` serves one on <http://localhost:3001>.

## What is built

| Phase | Status |
|---|---|
| 0 Foundation (repo, contracts, CI, clock, design system, shell) | Done |
| 1 Accounts and settings (sign-up, sign-in with lockout, password reset, settings) | Done |
| 2 Tasks, projects, lists (task model, repeats, Inbox, Upcoming, Search) | Done |
| 3 Note engine (splitter, English/Vietnamese extractors, command matcher, safety check, applier, LLM fallback) | Done. The language-model fallback is off by default and needs an API key |
| 4 Note flow (editor, Check this first, result screen, Undo all and redo, follow-ups, Edit note, Notes tab) | Done |
| 5 Offline and install (service worker, IndexedDB, sync, offline notes, install) | Done, except the retention purge job (IM-55) |
| 6 Hardening and release (end-to-end tests, security, performance, accessibility audit, deploy) | In progress |

The build plan, issue by issue, is in [docs/08-project/tasks.md](docs/08-project/tasks.md).

## How it works

| Part | What |
|---|---|
| `frontend/` | Next.js 16 and React 19, TypeScript strict, Tailwind CSS. A PWA with a service worker and an IndexedDB copy of the user's data for offline use |
| `backend/` | Laravel 13 JSON API at `/api/v1`, Sanctum cookie sessions ([ADR-007](docs/07-architecture/decisions/ADR-007-session-and-auth.md)) |
| Database | PostgreSQL 18 |
| `docker-compose.yml` | The whole stack: PostgreSQL, Mailpit, the API, a queue worker, the Next.js dev server and an opt-in production build (`web-prod`) |

A note is turned into tasks on the server in one request: it is normalised and split into items, each item is classified (task, command on an existing task, or skipped) and its fields are extracted with deterministic rules; items the rules are unsure about can go to a language model. The result is a **plan** that the user reviews before it is applied, and every applied note keeps an undo log for 30 days ([ADR-001](docs/07-architecture/decisions/ADR-001-note-plan-contract.md), [ADR-002](docs/07-architecture/decisions/ADR-002-undo-change-log.md)). Offline changes sync field by field, last writer wins ([ADR-004](docs/07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)).

| Read more | |
|---|---|
| [SUMMARY](docs/SUMMARY.md) | The whole spec in one read |
| [Screens](docs/01-product/screens.md) and [UX standards](docs/01-product/ux-standards.md) | Every screen and its states |
| [Modules](docs/03-modules/) | Requirements and edge cases per area (accounts, notes, tasks, lists, projects, platform) |
| [Architecture](docs/07-architecture/overview.md) | Components, API, data model, security, decisions (ADRs) |
| [Testing](docs/06-testing/test-strategy.md) | Test strategy, scenarios and the note corpus |

## Team

| Member | Area |
|---|---|
| **02bbits** | Platform: repo, CI, accounts, settings, offline sync, install, deployment |
| **3HoTuan3** | Tasks and views: task model, projects, Inbox, Upcoming, Search, design system |
| **khang-ngo4444** | Note understanding: the rules engine, the language-model fallback, the note corpus |

The note flow (editor, review, undo, Notes tab) was shared between the team through GitHub issues.

## For developers

### Run it

Needs only Docker.

```bash
docker compose up        # app on http://localhost:3000, API on :8000
```

The first start installs Composer and npm packages, creates `backend/.env` with an app key, then migrates and seeds (demo account: example@gmail.com / password). Every start migrates, so pulling new migrations needs no extra step. Code is mounted from the host and reloads on save. After changing `package.json`, restart `web` (`docker compose restart web`).

The service worker runs only in a production build. To check it, start one next to the dev server: `docker compose --profile prod up -d web-prod` serves it on <http://localhost:3001> (the first build takes a minute or two). Restart `web-prod` to get a new build, for example to see the update toast. Its worker and caches belong to :3001 only, so the dev app on :3000 stays uncached; clear the site data in DevTools when you're done.

Run commands inside the containers, for example `docker compose exec api php artisan test` or `docker compose exec web npm test`. The API container runs as UID 1000 by default; if yours differs, `export UID GID` first.

#### Without Docker for the app

PHP 8.4+ with `pdo_pgsql`, `intl` and `mbstring`, Composer, Node 20+. Start only the services with `docker compose up -d db mail`, set up once with `cd backend && composer setup && php artisan db:seed` and `cd frontend && npm install && cp .env.example .env.local`, then run `composer run dev` in `backend/` and `npm run dev` in `frontend/`.

Open the app at <http://localhost:3000>, not :8000. Emails such as password resets land in Mailpit at <http://localhost:8025>. API docs are generated from the code at <http://localhost:8000/docs/api> (local only). Use Chrome or Firefox locally: the session cookie is `Secure` with a `__Host-` prefix (ADR-007), and Safari rejects it over plain http.

### Time

Read the time only through the clock (ADR-006): `ClockInterface` on the server, `@/lib/clock` on the client. Tests pin it with `travelTo()` or `vi.setSystemTime()` plus a zone. A note's "now" is `ClientClock::fromWrittenAt()`: its `written_at`, clamped to server time. API calls go through `@/lib/api`, which sends `X-Timezone`.

### Checks

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
