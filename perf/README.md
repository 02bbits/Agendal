# Performance & Load Testing (IM-63)

Covers **[NF-4](../docs/05-quality/nfr.md#nf-4)**, **[NF-5](../docs/05-quality/nfr.md#nf-5)**, and **[Scalability](../docs/05-quality/scalability.md)**.

## Suites

1. **Performance Seeder (`backend/database/seeders/PerfSeeder.php`)**
   - Seeds 10 pool accounts (`perf1..perf10@agendal.test`) plus `perf-heavy@agendal.test` with **5,000 tasks** and **50 notes** for `PERF-05`.
   - Run locally:
     ```sh
     cd backend && php artisan db:seed --class=PerfSeeder
     ```

2. **k6 Note Processing Budget (`perf/k6/note-budget.js`)**
   - Submits 10-item notes (`NF-5`, `PERF-02`) and max-limit 30-item notes (`NF-14`) to `POST /api/v1/notes` plus `/undo`.
   - Enforces `note_processing_duration p(90) < 2000 ms` (or `< 300 ms` when `RULES_ONLY=true`), `note_max_items_duration p(90) < 2000 ms`, `note_undo_latency p(95) < 500 ms`, and error rate `< 0.1%`.
   - Run locally:
     ```sh
     BASE_URL=http://127.0.0.1:8000 k6 run perf/k6/note-budget.js
     ```

3. **k6 Scalability, Reconnect & 5k-Task User (`perf/k6/scalability.js`)**
   - **PERF-01:** Mixed traffic (60% reads, 25% sync pulls, 15% writes) enforcing `read_latency p(95) < 300 ms` and `write_latency p(95) < 500 ms`.
   - **PERF-04:** Reconnect burst (100 queued field patches + sync pull) enforcing `reconnect_sync_duration p(95) < 10000 ms`.
   - **PERF-05:** Heavy 5,000-task user (`/tasks`, `/counts`, `/tasks/search`, `/notes/search`, `/sync?full=1`, plus command matching `POST /notes`) enforcing `heavy_read_latency p(95) < 300 ms`.
   - Run locally:
     ```sh
     BASE_URL=http://127.0.0.1:8000 k6 run perf/k6/scalability.js
     ```

4. **Lighthouse CI First Load (`lighthouserc.json`) & Repeat Load (`perf/repeat-load.mjs`)**
   - Audits `/sign-in`, `/`, `/upcoming`, `/projects`, `/notes`, and `/search` under mobile (360×800) + simulated 4G / 4× CPU throttling.
   - Enforces `interactive <= 3000 ms` on first load (`NF-4`) and `domInteractive <= 1000 ms` on repeat load from the Service Worker cache.
   - Run locally against a production Next.js build (`npm run build && npm run start`):
     ```sh
     npx @lhci/cli@0.14.x autorun --config=./lighthouserc.json
     cd frontend && BASE_URL=http://127.0.0.1:3000 NODE_PATH=./node_modules node ../perf/repeat-load.mjs
     ```

## Nightly CI

`.github/workflows/nightly-perf.yml` runs nightly at `02:00 UTC` (and via `workflow_dispatch`), seeds Postgres (including `PerfSeeder`), starts Laravel + Next.js production server, runs k6 + slow-query log verification + Lighthouse CI + Repeat Load check, uploads artifacts, and opens a GitHub issue automatically if a scheduled run fails.
