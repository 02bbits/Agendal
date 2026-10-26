# M05 Tasks — Product Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| TK-1 | Complete a task | Must | Tapping the checkbox completes it, updates progress and shows a toast with Undo |
| TK-2 | Edit every field of a task | Must | Title, schedule (start–end), due date, reminder (None; 5, 15 or 30 minutes; 1 hour; 1 day before), repeat (Never, Daily, Weekly, Monthly, Yearly), priority (Low, Medium, High), project and notes |
| TK-3 | Validate the schedule | Must | An end before the start shows "End time must be later than the start time." |
| TK-4 | Repeat tasks | Must | Completing a repeating task creates the next one; deleting one asks "This task only" or "This and all future" |
| TK-5 | Delete a task safely | Must | Delete asks for confirmation and the toast offers Undo |
| TK-6 | Remind before a task | Should | A notification fires at the chosen offset from the start time, or from 09:00 on the due date when there is no time |
