# Performance & Load Testing (IM-63)

Covers **[NF-4](../docs/05-quality/nfr.md#nf-4)**, **[NF-5](../docs/05-quality/nfr.md#nf-5)**, and **[Scalability](../docs/05-quality/scalability.md)**.

## Suites

1. **k6 Note Processing Budget (`perf/k6/note-budget.js`)**
   - Submits 10-item notes to `POST /api/v1/notes` at burst rate (`2 req/s`).
   - Enforces `note_processing_duration p(90) < 2000 ms` (or `< 300 ms` when `RULES_ONLY=true`) and error rate `< 0.1%`.
   - Run locally against a running backend:
     ```sh
     BASE_URL=http://127.0.0.1:8000 k6 run perf/k6/note-budget.js
     ```

2. **k6 Scalability & Reconnect (`perf/k6/scalability.js`)**
   - Mixed traffic (60% reads, 25% sync pulls, 15% writes) enforcing `read_latency p(95) < 300 ms` and `write_latency p(95) < 500 ms`.
   - Reconnect burst (100 queued field patches + sync pull) enforcing `reconnect_sync_duration p(95) < 10000 ms`.
   - Run locally:
     ```sh
     BASE_URL=http://127.0.0.1:8000 k6 run perf/k6/scalability.js
     ```

3. **Lighthouse CI (`lighthouserc.json`)**
   - Audits mobile mid-range phone (360×800) with simulated 4G throttling (`150 ms` RTT, `1.6 Mbps`, `4x` CPU slowdown).
   - Enforces `interactive <= 3000 ms` (NF-4).
   - Run locally against a production Next.js build (`npm run build && npm run start`):
     ```sh
     npx @lhci/cli@0.14.x autorun --config=./lighthouserc.json
     ```

## Nightly CI

`.github/workflows/nightly-perf.yml` runs nightly at `02:00 UTC` (and via `workflow_dispatch`), starts Postgres + Laravel + Next.js production server, runs k6 + Lighthouse CI, uploads artifacts, and opens a GitHub issue automatically if a scheduled run fails.
