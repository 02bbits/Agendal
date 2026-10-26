# Golden Note Corpus

Executable examples of note understanding. Each case pins the clock, the zone, the existing tasks and the expected plan, so rules and the LLM fallback can be scored against the same truth ([ADR-001](../../07-architecture/technical-decisions/ADR-001-note-plan-contract.md), [ADR-008](../../07-architecture/technical-decisions/ADR-008-llm-fallback.md)).

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
    status: done                   # done | confirm | followup | error
    error: null                    # copy key when status is error
    name: SQL quiz
    create:
      - {title: SQL quiz, due: "2026-10-26", start: "09:00", priority: high,
         project: SQL Course, repeat: never, reminder: 1d}
    update: []                     # {task: t1, done: true} or {task: t1, due: ..., start: ..., label: ...}
    delete: []                     # [t1]
    skipped: []                    # {text: ..., reason: skip|already_done|not_found}
    ambiguous: []                  # tie cases: {candidates: [t4, t5], preselected: t4}
```

Omitted fields in `create` mean "empty / default" (no date, no time, no project, repeat never, reminder none, priority by the default rule).

## Coverage quota

The MVP gate needs **≥ 200 cases**, with at least **8 per category**, and **≥ 1 case per M03 edge case** (`edge.E1` … in the [M03 spec](../../03-modules/M03-note-understanding/spec.md#4-edge-cases)). `seed.yaml` holds the first 40 cases, and the team grows it from beta notes (with consent, and anonymised).

Categories: `split.*` (newline, comma, semicolon, period, then, bullets, digit-comma, merge), `date.*` (relative, weekday, explicit, month-end, passed), `time.*`, `priority.*`, `project.*`, `repeat.*`, `reminder.*`, `title.*`, `command.*` (complete, reschedule, delete, tie, no-match), `skip.*`, `safety.*`, `naming.*`, `offline.*`, `limit.*`, `edge.E*`.

## Accuracy gates

Run in both modes. Each mode must meet every gate.

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
