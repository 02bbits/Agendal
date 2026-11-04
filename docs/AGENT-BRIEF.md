# Agent brief

Loaded into every agent session (import it from CLAUDE.md). It is a map and a digest, so agents read only the spec section a task needs. The spec in `docs/01-product` to `docs/08-project` wins over this file. Keep it under ~150 lines, and update it in the same PR when a fact below changes.

## Reading rules (they save most of the tokens)

- **Never read a whole spec file to find one thing.** Every ID has an anchor: `grep -n 'id="nu-5"' docs -r`, then `Read` with `offset`/`limit` around that line. Module sections are numbered: `grep -n '^##' docs/03-modules/NU-note-understanding.md` gives the outline first.
- **Don't read** `docs/SUMMARY.md` (16k tokens; for humans), `docs/06-testing/note-corpus/variations.yaml` (36k), or `seed.yaml` whole. Grep a case ID (`C-044`) instead.
- **CHANGELOG:** read the top 30 lines only (newest first).
- **tasks.md:** grep the row: `grep -n 'id="im-46"' docs/08-project/tasks.md`.
- **Copy:** grep the key in `docs/01-product/copy-catalog.md` or `frontend/src/ui/copy/catalog.ts`; never read the catalog whole.
- **Code:** search with `grep -rn` or Explore for symbols, then read only the function. Don't open test files longer than needed; run one test file with `php vendor/bin/pest tests/Feature/X.php` or `npx vitest run tests/ui/x.test.tsx`.
- **GitHub:** `gh issue view N --json title,body --jq ...` and `gh pr view N --json ...`, not the full web pages.

Biggest spec files (tokens): NU 10k, tasks.md 7k, RV 6k, TK 5k, NC 5k, copy catalog 5k, traceability 4k. Everything else is under 3k.

## Product in one screen

Agendal: phone-first PWA. A note (typed; voice and files later) becomes tasks. English and Vietnamese notes (Vietnamese only with diacritics), English UI. Course demo, no analytics. Look: Graphite (monochrome, Inter).

**Note pipeline** (server, `POST /notes`, one request): normalise (≤ 5,000 chars) → split (new lines, commas, `;`, `.`, then/rồi/sau đó; ≤ 30 items) → classify (skip / command / task) → extract fields → (LLM fallback for low-confidence items: not on `main`) → match commands to open tasks (≥ 60% of words; ties ask) → validate → safety → name → persist. Deterministic: same text, time, zone, tasks → same plan.

**Plan shape** (ADR-001): `create[]`, `update[]`, `delete[]`, `skipped[]`. Entries carry a `ref` (`i1`, `i1-2`). Plan entries still name the due time `end_time`; the applier maps it to `due_time`.

**Note statuses:** `pending` (offline, not built) → `new` → `confirm` (any change, or a tie) | `done` (only skips: already_done, not_found, no_change; zero changes) | `followup` (nothing actionable). `confirm` → Apply → `done`; `confirm` → Edit note → `kept` (text goes to a new note). `done` → Undo all → `undone` → redo 10 s → `done`. Undo window 30 days. Edit note on a done note re-plans it (IM-47, not built).

**After Apply:** back to the list where the note was written, toast `note.made_*` with Undo (Undo all). The result screen (`/notes/{id}`) is reached from a note, or after an all-skips note.

**Follow-up and review (IM-46):** Keep it as task creates one literal task through the applier; Edit the note re-plans the same follow-up id with server edit time, preserving written_at. A minimal saved Notes list has all/made/needs/kept filters. Desktop uses a modal 400px result panel with a dimmed, inert background; clicking the scrim, Close or Escape dismisses it. Notes follows TaskPanel's theme-aware scrim, 2px blur and event-based background scroll lock, preserving sticky shell positioning. Smaller screens show the selected note full-screen. Preview task forms use Cancel/Done locally; Apply sends edits and excluded refs. Pending/offline Notes-list work remains IM-48.

**Task fields:** `title` (1–200, required), `project_id?`, `start_date?` + `start_time?`, `due_date?` + `due_time?`, `priority?` (low/medium/high), `reminder` (none, 5/15/30 min, 1 h, 1 day), `repeat` (never/daily/weekly/monthly/yearly) + `repeat_rule?` (RRULE ≤ 300) + server-set `repeat_anchor`, `notes?` (≤ 5,000), `done`, `done_at`, `created_by` (user/assistant), `source_note_id`, `field_updated_at` (per-field LWW stamps), `remind_at` (UTC). No `end_time` (migrated into `due_time`).

- A time needs its date. Start (date + time) strictly before due. Repeats shift start and due together. Reminder: start time → 09:00 start date → due time → 09:00 due date.
- Note commands treat `due_time` as an end only when start and due are the same day with a start time (`TaskCandidates::sessionEnd`).

**Lists** (spec): Inbox = Overdue (past due date) · Today (start or due today, in progress, or "Planned" start-only) · No date (neither date) · Completed (5, then Show all). Upcoming = from tomorrow, a task on its start day and its due day. Built code still groups by due date only.

**Time** (ADR-006): dates and times are floating local values, no zone. A note's "now" is its `written_at` clamped to server time. Read time only through the clock: `ClockInterface` / `ClientClock` on the server, `@/lib/clock` `now()` on the client, never `new Date()`. Tests pin clock and zone (`FrozenClock`, `travelTo`, `vi.setSystemTime`).

**Auth** (ADR-007): Sanctum cookie session, `__Host-` cookie (Chrome/Firefox locally, not Safari), CSRF header on writes. Lockout 3 failures → 60 s per (email, IP). Signed-out visitors see the shell; only a `401` redirects to Sign in.

**API** (`/api/v1`, JSON, one error shape `{error: {code, message, request_id, fields?}}`, other users' ids → 404, client-generated UUIDs for tasks/projects/notes):
`auth/register|login|logout|logout-everywhere|forgot-password|reset-password` · `GET/PATCH me` · `GET/POST notes`, `GET/PUT notes/{id}`, `POST notes/{id}/apply|cancel|undo|redo|make-task` · projects CRUD + `GET projects/none` + `POST projects/{id}/restore` · tasks CRUD + `POST tasks/{id}/complete|reopen|restore`. Not built: search, sync, clarify.

## Where code lives

| Area           | Files                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Note engine    | `backend/app/Services/Notes/` (`NoteEngine`, `NoteSplitter`, `ItemClassifier`, `FieldExtractor`, `NoteDateParser`, `NoteTimeParser`, `NoteRepeatParser`, `CommandMatcher`, `TaskCandidates`, `PlanValidator`, `PlanStatusResolver`, `NoteApplier`, `NoteUndo`, `NoteNamer`); entry `backend/app/Actions/ProcessNote.php`; rules CSV `backend/resources/notes/note-rules.csv`; limits `backend/config/notes.php` |
| Tasks          | `backend/app/Services/Tasks/` (`TaskPatcher` per-field LWW and validation, `TaskRecurrence`, `InboxQuery`, `UpcomingQuery`, `DueDateFallback`); `TaskController`, `StoreTaskRequest`, `TaskResource`                                                                                                                                                                                                            |
| Backend tests  | `backend/tests/Feature/*Test.php` (Pest, real Postgres `agendal_test`), corpus in `tests/Support/NoteCorpus.php`                                                                                                                                                                                                                                                                                                |
| Screens        | `frontend/src/app/<route>/` → `frontend/src/ui/features/{auth,lists,notes,projects,shell,tasks}`                                                                                                                                                                                                                                                                                                                |
| UI kit         | `frontend/src/ui/components/` (Button, Chip, DatePicker, Dialog, Sheet, Toast, Picker …); domain helpers `frontend/src/ui/domain/` (`lists.ts`, `edit.ts`, `describe.ts`, `types.ts`)                                                                                                                                                                                                                           |
| Client libs    | `frontend/src/lib/` (`api.ts` with `X-Timezone`, `apiError.ts`, `clock.ts`, `taskApi.ts`, `noteApi.ts`, `projectApi.ts`, `draft.ts`)                                                                                                                                                                                                                                                                            |
| Frontend tests | `frontend/tests/ui/*.test.ts(x)` (Vitest, `memoryApi.ts` fake, `fixtures.ts`)                                                                                                                                                                                                                                                                                                                                   |
| Contracts      | `docs/07-architecture/contracts/` (schemas, fixtures; a backend test checks them)                                                                                                                                                                                                                                                                                                                               |

## Conventions that cost a review round if missed

- No hard-coded strings in JSX (NF-12 scan): `t("key")`; new keys go in `src/ui/copy/pending.ts` until the catalog has them (`npm run gen:copy`).
- No type annotations like `Promise<…>` in component files; put them in `lib/`.
- One test per state or rule in the issue's "Done when", plus an axe check for new UI states.
- Next.js 16 has breaking changes: check `frontend/node_modules/next/dist/docs/` before using a Next API.
- A doc change gets a `docs/CHANGELOG.md` bullet under today's heading.

## Checks

```bash
cd backend && ./vendor/bin/pint --test && composer analyse && php artisan test
cd frontend && npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

Run only the affected test files while iterating, and the full suite once before committing.
