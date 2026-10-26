# Test Scenarios

Example account: example@gmail.com, with projects SQL Course, Adv Web, HCI, Portfolio and Personal. "Today" is **Fri 23 Oct 2026**.

These are the narrative end-to-end scenarios. They no longer grow: detailed and edge-case tests live in section 12 of each [module spec](../03-modules/), and each scenario below lists the automated tests that implement it.

### TS-01 — Several tasks from one note (NU-1, NU-2, NU-6, RV-1)
- **When** the student submits *"sql quiz monday 9am, email the group tonight, buy printer ink tomorrow"*
- **Then** three tasks are created:
  - SQL quiz: Mon 26 Oct 09:00, High, SQL Course, reminder 1 day before
  - Email the group: Fri 23 Oct 20:00, Medium, reminder 15 minutes before
  - Buy printer ink: Sat 24 Oct, Low
- **And** the note is named "This week", and the result shows 3 CREATED rows
- **Tests:** C-001, T-NU-01–07, T-NU-10–16, T-NU-50, T-RV-01

### TS-02 — Reschedule an existing task (NU-3)
- **Given** an open task "Renew gym membership" due today
- **When** the student submits *"move gym membership to sunday"*
- **Then** its due date becomes Sun 25 Oct, the result shows CHANGED "Due Sun 25 Oct (was today)", and the note is named "Update: Renew gym membership"
- **Tests:** C-017, T-NU-21, T-RV-02

### TS-03 — Command with no match (NU-3, M03 E29)
- **Given** no open task matches ≥ 60% of the words in "done the CV draft"
- **When** the student submits *"done the CV draft"*
- **Then** nothing is created or completed, and the result lists it under "Not made into tasks" as "Couldn't find a task matching “the CV draft”"
- **But** *"move dentist to friday"* with no match creates a new task "Dentist" due Fri 30 Oct
- **Tests:** C-028, C-029, T-NU-129

### TS-04 — Delete needs confirmation (NU-5, BR-01)
- **Given** an open task "Old reading list"
- **When** the student submits *"delete old reading list"*
- **Then** "Check this first" lists the delete, and nothing changes yet
- **When** they tap Cancel
- **Then** the task still exists, and the note is kept
- **Tests:** C-018, T-NU-40, T-RV-40

### TS-05 — More than 5 changes needs confirmation (NU-5)
- **When** a note produces 6 creates
- **Then** "Check this first" shows, and Apply changes creates all 6
- **Tests:** C-019, T-NU-41

### TS-06 — Nothing actionable (NU-4, RV-3)
- **When** the student submits *"idea: dark mode for the portfolio site"*
- **Then** "I couldn't find a task in this note." offers Keep as note / Make it a task
- **When** they tap Keep as note
- **Then** no task exists, and the note is named "Idea: dark mode for the portfolio" (its first 6 words)
- **Tests:** C-013, T-NU-33, T-RV-20, T-RV-21

### TS-07 — Undo all (RV-2, NF-11)
- **Given** a note that created 2 tasks, rescheduled 1 and (after confirmation) deleted 1
- **When** the student taps Undo all
- **Then** the 2 tasks are gone, the rescheduled task has its old date, the deleted task is back, and the note shows Undone
- **Tests:** T-RV-10, T-RV-11, T-RV-13

### TS-08 — Offline note (NC-6, AP-2)
- **Given** the device is offline
- **When** the student writes a note
- **Then** the button reads Save note, and the Notes tab shows the note as "Waiting for connection"
- **When** the connection returns
- **Then** the note is processed, and the toast says "Back online. 1 notes turned into N tasks."
- **Tests:** OFF-03, OFF-04, T-NC-40, T-NC-41

### TS-09 — Manual task with only a title (NC-7)
- **When** the student opens New task, types "Call mum" and taps Add
- **Then** the task exists with no date, and the toast says "Added “Call mum”"
- **Tests:** T-NC-50–53

### TS-10 — Schedule validation (TK-3)
- **When** a task's schedule is set to 14:00 – 13:00
- **Then** "End time must be later than the start time." shows, and nothing is saved
- **Tests:** T-TK-20–22

### TS-11 — Repeating task (TK-4)
- **Given** a weekly task "Weekly review" due Sun 25 Oct
- **When** it is completed
- **Then** a new "Weekly review" due Sun 1 Nov exists
- **When** the student deletes one occurrence
- **Then** they are asked "This task only" or "This and all future"
- **Tests:** T-TK-30, T-TK-31, T-TK-103

### TS-12 — Sign-in lockout (AA-3)
- **When** 3 sign-in attempts fail
- **Then** "Too many attempts" shows, and Sign in is disabled with a 60 s countdown
- **Tests:** T-AA-20, T-AA-103, SEC-05

### TS-13 — Password reset gives nothing away (AA-4)
- **When** a reset is requested for an email with no account
- **Then** the same confirmation shows as for an existing account
- **And** a sent link stops working after 60 minutes or after one use
- **Tests:** T-AA-30, T-AA-31, SEC-08, SEC-09

### TS-14 — Inbox order and empty state (LV-1)
- **Given** 1 overdue task and 3 tasks today, 1 of them done
- **Then** Overdue (red, count 1) is above Today, and the summary shows 1 of 4 (overdue tasks count toward today, [M06 §2.1](../03-modules/M06-lists-search/spec.md#21-inbox-lv-1))
- **When** every task for today is done
- **Then** "Nothing left for today" links to Upcoming
- **Tests:** T-LV-01, T-LV-02, T-LV-04

### TS-15 — Search (LV-3)
- **When** the student searches "quiz"
- **Then** open and completed matches are listed, with All / Open / Completed counts
- **When** they search "zzz"
- **Then** "No tasks match “zzz”" shows
- **Tests:** T-LV-20–22

### TS-16 — Delete a project (PJ-4)
- **Given** "Portfolio" with 3 tasks
- **When** the student deletes it
- **Then** they are asked to move the tasks to No project or delete them too, and the toast offers Undo
- **Tests:** T-PJ-30, T-PJ-31

### TS-17 — File too large (NC-4)
- **When** a 6 MB PDF is attached
- **Then** "Attach a file under 5 MB." shows, and nothing is extracted
- **Tests:** T-NC-24, T-NC-25

### TS-18 — Privacy (NF-9)
- **Given** a note owned by another account
- **When** it is requested by id
- **Then** it is not returned, and no analytics event contains note or task text
- **Tests:** SEC-12, SEC-44, SEC-61
