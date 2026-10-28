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
php artisan migrate

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

```bash
cd backend && ./vendor/bin/pint --test && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck
```
