# Handover

_A starting point for picking Agendal up, written 2026-11-03 for 02bbits, updated 2026-11-04 from `main` at `b30b8b2`. It is a snapshot: the live build status is section 13 of [SUMMARY.md](SUMMARY.md), and the spec in `docs/01-product` to `docs/08-project` is the source of truth._

## 1. The project in four lines

- **Agendal** is a phone-first PWA: write a note ("sql quiz monday 9am, buy ink tomorrow") and it becomes dated tasks you can review and undo. English and Vietnamese notes, English UI. A VNUK _Advanced Web Development_ course demo.
- **Stack:** Next.js 16 (TypeScript strict) in `frontend/`, Laravel 13 API at `/api/v1` in `backend/`, PostgreSQL 18, all on one Linux server.
- **Where it is:** phases 0 to 2 are mostly built, the note engine (phase 3) applies plans, and the note flow (phase 4) reaches Check this first. Offline, install and release (phases 5 and 6) haven't started.
- **Read first:** [SUMMARY.md](SUMMARY.md) (the whole spec in one read, about 20 minutes), then [tasks.md](08-project/tasks.md) for the build plan.

## 2. Run it

```bash
docker compose up
```

App on <http://localhost:3000> (not :8000), demo account `example@gmail.com` / `password`, mail in Mailpit at <http://localhost:8025>, API docs at <http://localhost:8000/docs/api>. Use Chrome or Firefox: the `__Host-` session cookie is `Secure`, and Safari rejects it over plain http. The [root README](../README.md) has the no-Docker route and the test database note.

Checks, the same as CI ([ci.yml](../.github/workflows/ci.yml)):

```bash
cd backend && ./vendor/bin/pint --test && composer analyse && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

## 3. Where things are

| You want                                     | Go to                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A requirement, its edge cases, API and tests | `docs/03-modules/<code>-*.md` (AA, AP, LV, NC, NU, PJ, RV, TK)                                                                                                                                                                                                      |
| What an IM task must do and its "Done when"  | `docs/08-project/tasks.md`, then `gh issue view N`                                                                                                                                                                                                                  |
| API shapes, JSON Schemas, fixtures           | `docs/07-architecture/api.md`, `docs/07-architecture/contracts/`                                                                                                                                                                                                    |
| Note engine                                  | `backend/app/Services/Notes/` (`NoteEngine` → `NoteSplitter`, `ItemClassifier`, `FieldExtractor`, `CommandMatcher`, `PlanValidator`, `PlanStatusResolver`, `NoteApplier`); `backend/app/Actions/ProcessNote.php`; rules in `backend/resources/notes/note-rules.csv` |
| Manual note cases                            | `backend/tests/Manual/note-cases.md`, `complex-note-cases.md`                                                                                                                                                                                                       |
| API routes                                   | `backend/routes/api.php` (no Search, Notes list, Undo or Sync endpoints yet)                                                                                                                                                                                        |
| Screens                                      | `frontend/src/app/` (routes), `frontend/src/ui/features/` (auth, lists, notes, projects, shell, tasks)                                                                                                                                                              |
| Client helpers                               | `frontend/src/lib/` (`api.ts`, `apiError.ts`, `clock.ts`, `noteApi.ts`, `taskApi.ts`, `projectApi.ts`, `draft.ts`)                                                                                                                                                  |
| UI strings                                   | `docs/01-product/copy-catalog.md` → `npm run gen:copy` → `src/ui/copy/catalog.ts`; strings not yet in the catalog go in `src/ui/copy/pending.ts`                                                                                                                    |
| What changed in the docs                     | `docs/CHANGELOG.md`                                                                                                                                                                                                                                                 |

## 4. How work flows

1. Pick an IM issue, read its row in `tasks.md` and the module sections it links.
2. Branch from current `origin/main` as `<issue#>-im-<nn>-<slug>` (for example `43-im-44-undo-all`).
3. Docs gaps or business decisions: ask the team first, then write the answer into the spec and add a `docs/CHANGELOG.md` bullet under today's date. Docs go in their own `docs: …` commit.
4. Build with the existing helpers: read time only through the clock (`@/lib/clock` `now()`, `ClockInterface` on the server, never `new Date()`), call the API through `@/lib/api`, keep JSX free of hard-coded strings.
5. One test per state or rule in the issue's "Done when", plus an axe check for new UI states.
6. Commit as `IM-nn: what it does` with `Refs #N`. PR title `IM-nn: Task name`, body **What / Decisions / Not in this PR / Tests**, ending `Closes #N`.
7. If the change moves the spec or the build status, update [SUMMARY.md](SUMMARY.md) in the same PR.

## 5. Your work

Your #126 (row label) and #127 (Undo all) are merged, so IM-47 Edit note can now reuse `NoteUndo`.

**Assigned to you, not started**

| Task                                     | Why it matters                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| IM-46 Follow-up (with 3HoTuan3)          | The `followup` status exists in the engine but has no screen, so a note with nothing actionable has nowhere to go                   |
| IM-50 to IM-55 Offline and install       | All of phase 5. IM-53 (offline notes) is on the critical path; IM-51 (IndexedDB) and IM-52 (sync, needs `GET /sync`) come before it |
| IM-60 Traceability script                | Part of the MVP gate: every acceptance criterion maps to a test                                                                     |
| IM-62 Security pass (with khang-ngo4444) | Authorization matrix, ASVS checklist, ZAP baseline                                                                                  |
| IM-65 Deploy                             | The demo must run on the public URL                                                                                                 |
| #77 Branded emails                       | Reset and password-changed mails still use Laravel's default layout                                                                 |

A sensible order: IM-46 (small, closes the note flow's last dead end), then IM-50 → IM-51 → IM-52 → IM-53.

## 6. Decisions waiting on the team

- **Lists after the start/due change** (#131 merged). Inbox and Upcoming still group by due date only; the spec's start-day entries, "Planned" and dashed due-day cards aren't built. It affects IM-51/52 too (what the device stores and syncs).
- **LLM fallback** (IM-38). The issue is closed, but the code is on a branch, not `main` (PR #123, with NVIDIA next to OpenRouter, was closed). Ask khang-ngo4444 where it stands before building IM-49 or the Notes tab.
- **Recurrence scope** (#121: should "3 times every day" make three series?) and the lost "for 3 months" end (#120).
- **Stale spec text.** See the last row of SUMMARY §13.

## 7. Things that will bite

- **Next.js 16 has breaking changes.** Read `frontend/node_modules/next/dist/docs/` before writing Next code.
- **Time is floating local** (ADR-006): due dates and times have no zone; "now" for a note is its `written_at`, clamped to server time. Tests pin the clock and zone.
- **The auth gate is deliberate:** signed-out visitors see the app shell, and only a `401` redirects to Sign in (#107). Errors and offline stay put.
- **Check this first returns a preview:** `confirm` changes are applied in a savepoint and rolled back, so their task ids are not the ones Apply creates. Match by each change's `ref`.
- **Tests use the `agendal_test` database.** On an old `db` volume, create it once (see the root README).
- **Push with** `git push -u origin <branch>`: some branches track `origin/main`.
