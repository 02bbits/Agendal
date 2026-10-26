# Task Model

Conceptual model. For storage, see [data-model.md](../07-architecture/data-model.md).

| Field | Values | Required | Ref |
|---|---|---|---|
| title | Sentence case. Acronyms kept upper case | **yes**, the only required field | NC-7 |
| project | One of the user's projects, or none (*No project*) | no | PJ |
| due date | A date | no | TK-2 |
| start time, end time | Times. End must be later than start | no | TK-3 |
| priority | Low, Medium, High | no | TK-2 |
| reminder | None; 5, 15 or 30 minutes; 1 hour; 1 day before | no | TK-2, TK-6 |
| repeat | Never, Daily, Weekly, Monthly, Yearly | no | TK-4 |
| notes | Free text. Searched by LV-3 | no | TK-2 |
| done, done at | Completion | system | TK-1 |
| created by | user or assistant | system | NU-7 |
| source note id | The note that made it | system | RV-1 |
| created at, updated at | Timestamps | system | — |

## Derived

- **Overdue**: not done and the due date is before today.
- **Today**: due date or start date is today.
- **Project progress**: completed tasks ÷ all tasks in the project ("3 of 5 tasks completed").

## Task states

A task is **open** or **done**. Deleting removes it, and it can be restored by Undo (toast or Undo all). Completing a repeating task creates its next occurrence (TK-4). See [state transitions](state-transition.md#task).
