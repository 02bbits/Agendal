# Scalability and Operations

Agendal runs on **one Linux server** ([Q14](../08-project/open-questions.md#q14)). The capacity model below is the sizing target ([A7](../08-project/project.md#a7)), and the design rules keep the path to more servers open.

## Capacity model

| Quantity | Target | Derived load |
|---|---|---|
| Registered users | 5,000 | — |
| Weekly / daily active | 2,000 / 1,200 | — |
| Sessions per active user per day | 5 | ~6,000 sessions/day |
| Notes per active user per day | 4 | ~5,000 notes/day. Peak hour ≈ 15% → ~750/h. Burst ×10 → **~2 notes/s** |
| Items per note (average) | 3 | ~15,000 plan items/day |
| LLM share of notes | ≤ 20% ([A8](../08-project/project.md#a8)) | ≤ 1,000 model calls/day, capped by budget |
| Requests per session | ~15 (lists, sync, edits) | ~90,000 req/day. Peak **~15 req/s** |
| Tasks per user (after six months) | ~1,000 | ~5 M rows at the target |
| Reminders | ~2 per active user per day | ~2,400/day. Peak minute (08:45–09:00) ≈ 300 |

## Service levels

| SLI | SLO |
|---|---|
| Read endpoints latency | p95 ≤ 300 ms |
| Write endpoints latency | p95 ≤ 500 ms |
| Note processing, note submitted → result ([NF-5](nfr.md#nf-5)) | p90 ≤ 2 s. Rules-only path p90 ≤ 300 ms |
| Reminder delivery delay | p95 ≤ 60 s after `remind_at` |
| Sync after reconnect ([NF-6](nfr.md#nf-6)) | Queue flushed and pulled within 10 s for ≤ 100 queued edits |
| First load / repeat load ([NF-4](nfr.md#nf-4)) | ≤ 3 s / ≤ 1 s |

## Design rules that keep it scaling

| Rule | Why |
|---|---|
| **Stateless API.** Sessions and rate-limit counters in PostgreSQL (or Redis later), no local disk | A second API server can be added without sticky sessions |
| **Every list is cursor-paginated** (`?cursor=&limit=`, max 100). Inbox and Upcoming are bounded by date range. The Notes tab, search and completed tasks use keyset pagination | No `OFFSET` scans. Constant cost per page |
| **Every query is scoped by `user_id`**, and every index leads with `user_id` | Per-user data stays small |
| **Sync is incremental** by `change_seq` ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)) | Cost grows with changes, not with data size |
| **Reminders query an indexed `remind_at`** once a minute, claiming rows with `SELECT … FOR UPDATE SKIP LOCKED` | More workers can run in parallel without double-sending |
| **Slow work runs on the queue:** file extraction and push delivery. The LLM call is the one synchronous outside call, made from the request with a hard 1.5 s timeout ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)) | Request latency stays flat. A slow provider costs at most 1.5 s per affected note |
| **Command matching** uses a trigram index (`pg_trgm` on `unaccent(title)`) to find ≤ 50 candidate open tasks, then scores in memory | O(items × 50), not O(items × all tasks) |
| **Static assets** have immutable, hashed filenames, served by Nginx with long cache headers. The service worker caches the app shell | First load ≤ 3 s, repeat ≤ 1 s |

**Beyond one server:** a second API server behind Nginx, a read replica for search and lists, then Redis for sessions and Inbox counts. None of this is needed for the demo.

## Data protection and operations

| Item | Target |
|---|---|
| Backups | Nightly `pg_dump`, kept 7 days and copied off the server. Restore tested before the demo |
| Retention | Tombstones purged after 30 days ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)). Audit log 90 days. App logs 14 days |
| Migrations | Expand → migrate → contract. No destructive migration in the same release as the code that stops using a column |

## Load-test plan

PERF tests live in the [test strategy](../06-testing/test-strategy.md#levels-and-tools). They run against the server before the demo.

| ID | Scenario | Pass |
|---|---|---|
| PERF-01 | 15 req/s mixed traffic (lists 60%, sync 25%, edits 15%) for 30 min | SLOs above hold, error rate < 0.1% |
| PERF-02 | 2 notes/s burst for 5 min, 20% routed to a stubbed LLM with 1.2 s latency | [NF-5](nfr.md#nf-5) p90 ≤ 2 s |
| PERF-03 | 300 reminders due in one minute | All sent within 60 s, none duplicated |
| PERF-04 | One device reconnects with 100 queued edits and 10 pending notes | Done within 10 s, no loss, correct LWW |
| PERF-05 | User with 5,000 tasks: search, Inbox and Upcoming | Read p95 ≤ 300 ms |
