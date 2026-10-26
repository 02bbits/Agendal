# Scalability and Operations

Designed for the **closed beta** (A7), with a known path to 10×.

## Capacity model

| Quantity | Beta assumption | Derived load |
|---|---|---|
| Registered students | 5,000 | — |
| Weekly / daily active | 2,000 / 1,200 | — |
| Sessions per active user per day | 5 | ~6,000 sessions/day |
| Notes per active user per day | 4 | ~5,000 notes/day. Peak hour ≈ 15% → ~750/h. Burst ×10 → **~2 notes/s** |
| Items per note (average) | 3 | ~15,000 plan items/day |
| LLM share of notes | ≤ 20% (A8) | ≤ 1,000 model calls/day, capped by budget |
| Requests per session | ~15 (lists, sync, edits) | ~90,000 req/day. Peak **~15 req/s** |
| Tasks per user (after a semester) | ~1,000 | ~5 M rows at full beta |
| Reminders | ~2 per active user per day | ~2,400/day. Peak minute (08:45–09:00) ≈ 300 |

## Service levels (beta)

| SLI | SLO |
|---|---|
| API availability (monthly, excluding planned maintenance) | ≥ 99.5% |
| Read endpoints latency | p95 ≤ 300 ms |
| Write endpoints latency | p95 ≤ 500 ms |
| Note processing, note submitted → result (NF-5) | p90 ≤ 2 s. Rules-only path p90 ≤ 300 ms |
| Reminder delivery delay | p95 ≤ 60 s after `remind_at` |
| Sync after reconnect (NF-6) | Queue flushed and pulled within 10 s for ≤ 100 queued edits |
| First load / repeat load (NF-4) | ≤ 3 s / ≤ 1 s |

## Design rules that keep it scaling

| Rule | Why |
|---|---|
| **Stateless API.** Sessions in Redis or the DB, no local disk | Add API instances behind the load balancer without sticky sessions |
| **Every list is cursor-paginated** (`?cursor=&limit=`, max 100). Inbox and Upcoming are bounded by date range. The Notes tab, search and completed tasks use keyset pagination | No `OFFSET` scans. Constant cost per page |
| **Every query is scoped by `user_id`**, and every index leads with `user_id` | Per-user data stays small, and the data could be partitioned by user later |
| **Sync is incremental** by `change_seq` ([ADR-005](../07-architecture/technical-decisions/ADR-005-sync-protocol.md)) | Cost grows with changes, not with data size |
| **Reminders query an indexed `remind_at`** once a minute, claiming rows with `SELECT … FOR UPDATE SKIP LOCKED` | Several workers can run in parallel without double-sending |
| **Slow work runs on queues:** file extraction and push delivery. The LLM call is the one synchronous outside call, made from the request with a hard 1.5 s timeout ([ADR-008](../07-architecture/technical-decisions/ADR-008-llm-fallback.md)) | Request latency stays flat. Queues absorb bursts. A slow provider costs at most 1.5 s per affected note |
| **Command matching** uses full-text search to find ≤ 50 candidate open tasks, then scores in memory | O(items × 50), not O(items × all tasks) |
| **Static assets on a CDN** with immutable, hashed filenames. App shell cached by the service worker | First load ≤ 3 s, repeat ≤ 1 s, low origin traffic |

## Path to 10×

At ~50,000 users or ~150 req/s peak:

1. More API and worker instances.
2. A read replica for search and lists.
3. Redis caching for Inbox counts.
4. Partitioning `tasks` by `user_id` hash, if the table passes ~50 M rows.
5. SSE for sync, replacing polling.

None of these is needed for the beta.

## Data protection and operations

| Item | Target |
|---|---|
| Backups | Automated daily full backup plus continuous WAL/binlog. Restore tested monthly |
| RPO / RTO | ≤ 15 min / ≤ 4 h |
| Retention | Tombstones purged after 30 days (ADR-005). Audit log 90 days. App logs 14 days. Deleted accounts purged within 30 days (pending Q7) |
| Migrations | Expand → migrate → contract. No destructive migration in the same release as the code that stops using a column |
| Environments | Staging mirrors production config. Load tests run there |

## Load-test plan

PERF tests live in the [test strategy](../06-acceptance/test-strategy.md#levels-and-tools).

| ID | Scenario | Pass |
|---|---|---|
| PERF-01 | 15 req/s mixed traffic (lists 60%, sync 25%, edits 15%) for 30 min | SLOs above hold, error rate < 0.1% |
| PERF-02 | 2 notes/s burst for 5 min, 20% routed to a stubbed LLM with 1.2 s latency | NF-5 p90 ≤ 2 s |
| PERF-03 | 300 reminders due in one minute | All sent within 60 s, none duplicated |
| PERF-04 | One device reconnects with 100 queued edits and 10 pending notes | Done within 10 s, no loss, correct LWW |
| PERF-05 | User with 5,000 tasks: search, Inbox and Upcoming | Read p95 ≤ 300 ms |
