# Task Model

Conceptual model. For storage details, see [data-model.md](../07-architecture/data-model.md).

| Attribute | Type | Required | Rules / Source |
|---|---|---|---|
| title | text | **yes** | The only required field (FR-23) |
| description | text | no | Searchable (FR-61) |
| priority | High \| Medium \| Low | no | Exactly three levels (FR-25) |
| project | Project | no | Empty means *No project* (FR-36) |
| due date | date (+ optional time) | no | Drives *overdue* (FR-32) |
| scheduled date / start / end | date + times | no | End must be after start (FR-30). Can be removed without deleting the task (FR-31) |
| reminder | absolute datetime or offset before scheduled start | no | Offsets: 5/15/30 min, 1 h, 1 day (FR-56) |
| completed at | datetime | no | Set on completion, cleared on reopen (FR-27–28) |
| recurrence | series + occurrence date | no | Daily/weekly/monthly/yearly, optional end date (FR-39–40) |
| origin | manual \| assistant (+ reply ID) | system | Needed for summary cards and undo (FR-18, FR-20) |

## Derived values

- **Overdue** = `due date < now AND not completed`.
- **In today** = `due date is today OR scheduled date is today`.
- **Project progress** = completed tasks / total tasks in the project (FR-37).

All dates and times are interpreted in the **user's time zone** (FR-10).
