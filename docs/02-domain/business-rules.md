# Business Rules

The single source for how a note becomes tasks (M03), plus rules that cut across modules. The prototype does this with rules. v1 can use a language model with structured output, but it must produce the same plan shape and follow the same rules ([ADR-001](../07-architecture/technical-decisions/ADR-001-note-plan-contract.md)).

## Splitting (NU-1)

Items split on new lines, commas, semicolons, full stops and "then". Bullets are stripped. One task per actionable item.

## What is extracted from each item (NU-2)

| Field | Understood phrases (examples) | Result | When nothing is found |
|---|---|---|---|
| Due date | today, tonight, this evening, tomorrow / tmr, day after tomorrow, Monday … Sunday ("next", "this", "by", "on"), next week, in 3 days, in a week, end of the week, end of the month, 26 Oct | A date. Weekdays mean the next one ahead | No date (or today if a repeat or time is given) |
| Time | 9am, 6:30pm, at 14, 14:00, morning (09:00), noon (12:00), evening (19:00), tonight (20:00) | Start time | No time |
| Priority | urgent, asap, important, high priority, deadline, exam, quiz, submit → High. low priority, whenever, someday, maybe → Low | Priority | Medium if due today, otherwise Low |
| Project | The project's name anywhere in the item, or course keywords (e.g. sql / database / ER diagram → SQL Course; gym, mum, groceries → Personal) | Project | No project |
| Repeat | every day / daily, every week / weekly / every Monday, every month / monthly | Repeat | Never |
| Reminder | Exams and quizzes → 1 day before. Any task with a time → 15 minutes before | Reminder | None |
| Title | What is left after removing the date, time, priority and repeat words and lead-ins ("remember to", "I need to", "please") | Sentence-case title. Acronyms (SQL, HCI, CV, UI, API, PDF) kept upper case | — |

## Commands for existing tasks (NU-3)

| Command | Phrases | Effect |
|---|---|---|
| Complete | done X, finished X, did X, X is done | Marks the task done |
| Reschedule | move / push / reschedule / postpone X to \<when> | Sets the new due date (and time). The result shows "was …" |
| Delete | delete / cancel / remove / drop X | Deletes the task, always after confirmation |

A command matches the **open** task whose title contains at least **60%** of the command's meaningful words. With no match, the item is treated as a new task.

## Skipped text (NU-4)

Items that start with *idea, note, thought, remember that* or *fyi*, and filler such as "hmm", "ok", "test" or "thanks". They stay in the note but make no task.

## Safety rules

| ID | Rule | Ref |
|---|---|---|
| BR-01 | Any delete, or more than 5 changes from one note, needs Apply changes before anything happens | NU-5 |
| BR-02 | A note with no actionable item gets one question: Keep as note, or Make it a task | RV-3 |
| BR-03 | Every applied note can be undone as a whole from its result screen | RV-2, NF-11 |
| BR-04 | Offline notes wait. They are processed on reconnect, in order, under the same rules | NC-6 |

## Naming a note (NU-6)

| Plan | Name | Example |
|---|---|---|
| One task | The task's title | Call mum |
| One change | "Update:" + title | Update: Renew gym membership |
| Only changes | "Updates to N tasks" | Updates to 3 tasks |
| All tasks in one project | Project + "to-dos" | SQL Course to-dos |
| All tasks due the same day | Today's plan / Tomorrow's plan / weekday + plan | Monday plan |
| All due within 7 days | This week | This week |
| Anything else | First title + "+ N more" | Call mum + 1 more |
| Nothing actionable | The note's first words (up to 6) | Ideas for the portfolio site |

The first row that matches wins. Names longer than 34 characters are cut at a word boundary with an ellipsis.

## Other rules

| ID | Rule | Ref |
|---|---|---|
| BR-10 | Only a title is needed to create a task by hand | NC-7 |
| BR-11 | A schedule's end must be later than its start: "End time must be later than the start time." | TK-3 |
| BR-12 | A reminder fires at its offset from the start time, or from 09:00 on the due date when there is no time | TK-6 |
| BR-13 | Completing a repeating task creates the next one. Deleting one asks "This task only" or "This and all future" | TK-4 |
| BR-14 | Deleting a task asks for confirmation, and the toast offers Undo | TK-5 |
| BR-15 | Deleting a project asks whether to move its tasks to No project or delete them too. The toast offers Undo | PJ-4 |
| BR-16 | A project has a name and one of 8 colours | PJ-1 |
| BR-17 | A password is at least 8 characters and differs from the email | AA-1 |
| BR-18 | After 3 failed sign-ins, Sign in is disabled for 60 s with a countdown | AA-3 |
| BR-19 | Password reset shows the same confirmation whether or not the account exists. The link is single-use and expires in 60 minutes. Resend unlocks after 45 s | AA-4, NF-10 |
| BR-20 | Inbox shows Overdue before Today | LV-1 |
| BR-21 | Offline conflicts resolve last-write-wins **per field** | NF-6 |
| BR-22 | Files up to 5 MB: text, Markdown, CSV, PDF, Word, photos. The file is discarded after text extraction | NC-4, NF-9 |
