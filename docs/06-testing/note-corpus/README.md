# Golden Note Corpus

Run `cd backend && php vendor/bin/pest tests/Unit/Services/NoteCorpusTest.php` to check coverage and accuracy in rules mode. The runner lives in `backend/tests/Support/NoteCorpus.php` and runs in the normal Pest CI job.

The corpus contains 429 cases: 51 seed examples, 357 variations and 21 additional edge decisions. Every represented non-edge category has at least eight cases, and all 41 NU edges are represented. Variations expand the same patterns; they are regression coverage, not an independent holdout set.

**LLM temporarily disabled (2026-11-03).** IM-38 is excluded from this integration. The runner uses only `NoteEngine`, makes no provider calls and has no LLM nightly workflow. LLM accuracy and live-provider validation remain deferred under IM-38 / IM-39 (#37 / #38); the original both-mode acceptance criterion is not complete.

Expected statuses follow BR-01: any create, update or delete requires `confirm`. Reschedule labels describe the new schedule; before values are separate result metadata. `processed_at` documents offline processing time; this plan-level runner resolves dates from `now` (the written time). Persistence, clock clamping and replay are covered by the API tests.

Executable examples of note understanding. Each case pins the clock, the zone, the existing tasks and the expected plan, so rules and the LLM fallback can be scored against the same truth ([ADR-001](../../07-architecture/decisions/ADR-001-note-plan-contract.md), [ADR-008](../../07-architecture/decisions/ADR-008-llm-fallback.md)).

## Format

One YAML list per file (`*.yaml`). Each case:

```yaml
- id: C-001                        # stable, never reused
  categories: [split.comma, date.weekday, priority.keyword]
  now: "2026-10-23T08:12"          # local wall time when the note was written
  timezone: Asia/Ho_Chi_Minh
  processed_at: null               # optional: set for offline notes processed later (ADR-006)
  projects: [SQL Course, Adv Web, HCI, Portfolio, Personal]   # default if omitted
  open_tasks:                      # optional: tasks commands can match
    - {id: t1, title: Email the group, due: "2026-10-23"}
  done_tasks: []                   # optional
  note: "sql quiz monday 9am"
  expect:
    status: confirm                # done | confirm | followup | error
    error: null                    # copy key when status is error
    name: SQL quiz
    create:
      - {title: SQL quiz, due: "2026-10-26", start: "09:00", priority: high,
         project: SQL Course, repeat: never, reminder: 1d}
    update: []                     # {task: t1, done: true} or {task: t1, due: ..., start: ..., label: ...}
    delete: []                     # [t1]
    skipped: []                    # {text: ..., reason: skip|already_done|not_found|no_change}
    ambiguous: []                  # tie cases: {candidates: [t4, t5], preselected: t4}
```

Omitted fields in `create` mean "empty / default" (no date, no time, no project, repeat never, reminder none, priority by the default rule). `due` is the due date, `start` and `end` are times, and `start_date` is the start date ([NU-E42](../../03-modules/NU-note-understanding.md#nu-e42)); `start_date` is checked only when a case gives it.

## Coverage quota

The MVP gate needs **≥ 200 cases**, with at least **8 per category**, and **≥ 1 case per NU edge case** (`edge.NU-E1` … in the [NU module](../../03-modules/NU-note-understanding.md#4-edge-cases)). `seed.yaml` holds the first 51 cases (C-044–C-051 are Vietnamese), and the team adds cases whenever a rule changes or a misread note is found.

Categories: `split.*` (newline, comma, semicolon, period, then, bullets, digit-comma, merge), `date.*` (relative, weekday, explicit, month-end, passed), `time.*`, `priority.*`, `project.*`, `repeat.*`, `reminder.*`, `title.*`, `command.*` (complete, reschedule, delete, tie, no-match), `skip.*`, `safety.*`, `naming.*`, `offline.*`, `limit.*`, `edge.NU-E*`, `lang.vi`.

## Accuracy gates

Run in both modes. Each mode must meet every gate.

Only rules mode is enabled for now. Count accuracy is measured once per note, with all three change counts required to match. Unexpected skipped items and ambiguity sets fail their safety/command gates. Explicit `end`, `notes` and `duplicate_of` expectations must all match (the runner's additional `details` gate, 100%).

| Measure | Gate |
|---|---|
| Notes with the exact number of creates, updates and deletes | ≥ 95% |
| Created tasks with the exact due date | ≥ 95% |
| … exact start time | ≥ 95% |
| … exact priority / project / repeat / reminder | ≥ 90% each |
| Commands that target the right task (or the right tie set) | **100%** |
| Safety outcome (`confirm` / `followup` / `error`) | **100%** |
| Note name (rules mode) | 100% |
| Note name (LLM mode) | ≥ 95% |

A wrong command target or a missed confirmation is never acceptable. Those gates are absolute.
