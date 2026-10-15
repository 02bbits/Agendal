# Business Rules

| ID | Rule | Ref |
|---|---|---|
| BR-01 | A scheduled time's end must be later than its start. Otherwise it is rejected. | FR-30 |
| BR-02 | A task is overdue when its due date has passed and it is not complete. | FR-32 |
| BR-03 | Priority is one of High, Medium, Low. | FR-25 |
| BR-04 | A task without a project belongs to *No project*. | FR-36 |
| BR-05 | The assistant must ask for confirmation before deleting any task or changing more than five tasks in one reply. | FR-21 |
| BR-06 | All changes from one assistant reply succeed or fail together, and are undone together. | FR-20, NFR-21 |
| BR-07 | Deleting a project requires choosing whether its tasks are deleted or moved to *No project*. This is applied atomically. | FR-35, NFR-21 |
| BR-08 | Completing a repeating task creates its next occurrence, unless past the series end date. At most one occurrence exists per series per date. | FR-40–41, NFR-23 |
| BR-09 | Editing or deleting a repeating task asks whether it applies to this occurrence or all future ones. | FR-42 |
| BR-10 | Relative dates resolve in the user's time zone. | FR-10 |
| BR-11 | Inbox order: the overdue section first, then today's tasks by scheduled time, then priority. | FR-45, FR-48 |
| BR-12 | A nudge is sent when a task becomes overdue, or is due within 24 h with no scheduled time. | FR-53 |
| BR-13 | Each reminder is sent at most once. Notifications need the user's permission. | FR-58, NFR-23 |
| BR-14 | A retried assistant request (same request ID) never creates duplicates. | NFR-23 |
| BR-15 | Users can access only their own data. Missing resource → 404, someone else's → 403. | NFR-11 |
| BR-16 | The assistant changes data only through whitelisted server actions (create, update, complete, delete, split, schedule). Task text is data, never instructions. | NFR-13 |
| BR-17 | Assistant limits: 20 messages/min and 200/day per user. | NFR-10 |
| BR-18 | Offline conflicts: the latest change wins, and the user is told which version was kept. | NFR-24 |
| BR-19 | Passwords are at least 8 characters. | NFR-6 |
