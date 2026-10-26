# Note Model

The note is the centre of v2: every assistant action comes from one note, and the note keeps enough to explain and undo it.

## Note

| Field | Meaning |
|---|---|
| id, user id | Owner (NF-9) |
| text | What the student wrote, or the checked text from dictation or a file |
| name | Generated name ([naming rules](business-rules.md#naming-a-note-nu-6)) |
| source file name | Set when the note came from a file. The file itself is not kept (NF-9) |
| status | `pending`, `new`, `done`, `confirm`, `followup`, `kept`, `undone` ([state transitions](state-transition.md)) |
| plan | What the assistant intends to do (below) |
| applied | The list of changes actually made (below) |
| created at, processed at | Timestamps. Pending notes have no `processed at` until reconnect |

## Plan

Built once per note, by rules or a language model. Either way it has the same shape ([ADR-001](../07-architecture/technical-decisions/ADR-001-note-plan-contract.md)):

| Part | Holds |
|---|---|
| create | New tasks with their extracted fields |
| update | Matched existing tasks, with the new values (complete or reschedule) |
| delete | Matched existing tasks to delete |
| skipped | Text kept in the note but making no task |

## Change

One entry in `Note.applied`.

| Field | Meaning |
|---|---|
| kind | `created`, `changed` or `deleted` |
| task id | The task affected |
| before values | Field values before the change. Enough to undo exactly (NF-11) |
| label | What the result screen shows, e.g. "Due Fri (was today)" |
