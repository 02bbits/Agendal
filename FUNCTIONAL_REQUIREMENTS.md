# Functional Requirements

Generated from the module files in `docs/03-modules/`, which are the source. Priority: **Must** = v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

### Account & Access

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| AA-1 | Create an account with email and password | Must | Password is at least 8 characters and differs from the email; Create account stays disabled until valid; success opens Inbox with "Welcome to Agendal. Your account is ready." |
| AA-2 | Sign in with email and password | Must | Wrong details show "Email or password is incorrect."; password has show/hide; a Remember me checkbox (on by default) keeps the session on this device |
| AA-3 | Lock sign-in after repeated failures | Must | After 3 failed attempts, a "Too many attempts" banner shows and Sign in is disabled for 60 s with a countdown |
| AA-4 | Reset a forgotten password by email | Must | The same confirmation shows whether or not the account exists; the link expires in 60 minutes; Resend unlocks after 45 s |
| AA-5 | Sign out | Must | Sign out in the Account sheet returns to Sign in |

### Note Capture

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| NC-1 | Open the note editor in one tap from any list screen | Must | The capture bar and the Notes tab open a full-screen editor with the cursor in the text; examples show while it is empty |
| NC-2 | Write a free-text note containing several tasks | Must | No fields are required; Make tasks is enabled as soon as there is text |
| NC-3 | Dictate a note | Should | The mic shows "Listening…" with Stop; the recognised text lands in the editor to check ("Here's what I heard."); Make tasks is disabled while listening |
| NC-4 | Turn a file into a note | Should | Accepts text, Markdown, CSV, PDF, Word and photos up to 5 MB; extracted text lands in the editor to check; a removable file chip shows; unsupported or oversized files get a specific error; the result shows "From \<file name>" |
| NC-5 | Start from an example | Could | Tapping an example chip fills the editor |
| NC-6 | Capture while offline | Must | The button reads Save note; the note is stored on the device as "Waiting for connection"; on reconnect it is processed automatically with a toast "Back online. N notes turned into M tasks." |
| NC-7 | Add a task by hand | Must | The + button opens New task: only a title is required; due chips Today, Tomorrow, Next week, No date, Pick date…; priority; project; a toast confirms "Added “…”" |

### Note Understanding

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| NU-1 | Split a note into items and make one task per actionable item | Must | Items split on new lines, commas, semicolons, full stops and "then" ("rồi", "sau đó"); bullets are stripped |
| NU-2 | Fill in each task's details | Must | Due date, time, priority, project, repeat and reminder are set per the extraction rules, for English and Vietnamese phrases; anything not found is left empty |
| NU-3 | Act on existing tasks from a note | Must | "done X", "move X to Friday" and "delete X" find the matching task and complete, reschedule or delete it |
| NU-4 | Ignore text that isn't a task | Must | Ideas, FYIs and filler are kept in the note but make no task; a note with nothing actionable triggers the follow-up |
| NU-5 | Ask before risky changes | Must | Any delete, or more than 5 changes in one note, shows "Check this first" with the planned changes; nothing is applied until Apply changes |
| NU-6 | Name each note automatically | Should | The name follows the naming rules and shows on the result screen and Notes card |
| NU-7 | Label tasks the assistant made | Should | Task details show "Created by the assistant" |

### Review & Control

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| RV-1 | Show what happened after every note | Must | The result screen lists each created, changed and deleted task with a CREATED / UPDATED / DELETED badge and its meta; created and changed tasks open their details; created tasks with no date offer When? chips (Q4) |
| RV-2 | Undo a whole note in one tap | Must | Undo all removes created tasks, reverts changes and restores deleted tasks; the note is kept and marked Undone |
| RV-3 | Resolve unclear notes | Must | "I couldn't find a task in this note." offers Keep as note or Make it a task |
| RV-4 | Keep every note | Must | The Notes tab lists notes newest first with time, name, excerpt and task count; a card opens its result |
| RV-5 | Edit a note to re-plan it (Q1) | Must | Edit note opens the note's text in the editor; Make tasks undoes what the note applied and plans the new text under the same safety rules; the card shows Edited |

### Tasks

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| TK-1 | Complete a task | Must | Tapping the checkbox completes it, updates progress and shows a toast with Undo |
| TK-2 | Edit every field of a task | Must | Title, schedule (start–end), due date, reminder (None; 5, 15 or 30 minutes; 1 hour; 1 day before), repeat (Never, Daily, Weekly, Monthly, Yearly), priority (Low, Medium, High), project and notes |
| TK-3 | Validate the schedule | Must | An end before the start shows "End time must be later than the start time." |
| TK-4 | Repeat tasks | Must | Completing a repeating task creates the next one; deleting one asks "This task only" or "This and all future" |
| TK-5 | Delete a task safely | Must | Delete asks for confirmation and the toast offers Undo |
| TK-6 | Remind before a task | Should | A notification fires at the chosen offset from the start time, or from 09:00 on the due date when there is no time |

### Lists & Search

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| LV-1 | Show today in Inbox | Must | A summary shows done of total for today; Overdue (in red, with a count) comes before Today; when all are done, "Nothing left for today" links to Upcoming |
| LV-2 | Show what's coming | Must | Upcoming groups tasks by day and filters All / Scheduled / Due only |
| LV-3 | Find any task | Must | Search covers titles and notes, completed included, with All / Open / Completed counts; no match shows "No tasks match “…”" |
| LV-4 | Show task context in every row | Must | Each row shows project dot and name, time, reminder and repeat icons, and a priority flag for High and Medium |

### Projects

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| PJ-1 | Create a project | Must | Name plus one of 8 colours; the new project opens straight away |
| PJ-2 | View a project | Must | Progress bar with "N of M tasks completed", then open and completed tasks |
| PJ-3 | Rename a project or change its colour | Should | Both available from the project's menu |
| PJ-4 | Delete a project | Must | A dialog asks whether to move its tasks to No project or delete them too; the toast offers Undo |

### App & Platform

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| AP-1 | Install as an app | Must | After the first sign-in, an Install banner shows once (Install / Not now); Install app stays available in Account |
| AP-2 | Work offline | Must | Every edit is saved on the device and syncs later; a "You're offline" banner shows on list screens |
| AP-3 | Light and dark themes | Must | Follows the system setting; Dark mode can be switched in Account |
| AP-4 | Consistent back navigation | Must | The in-app back button and the browser's Back both return to the previous screen |
| AP-5 | Choose week start and time format (Q6) | Must | Account has Week starts on (Monday / Sunday) and Time format (24-hour / 12-hour); every date picker, list and note phrase such as "next week" follows them |
