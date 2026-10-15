# Test Scenarios

Acceptance scenarios for the main flows. Add one `TS-nn` per requirement as it is implemented, and record it in the [traceability matrix](traceability-matrix.md).

### TS-01 — Multiple tasks from one message (FR-09, FR-10, FR-11)
- **Given** a logged-in user in time zone Asia/Ho_Chi_Minh on Wednesday 2026-10-14
- **When** they send *"I have a SQL quiz next Monday and need to email my group tonight"*
- **Then** two tasks are created: "SQL quiz" due 2026-10-19, and "Email my group" due 2026-10-14 in the evening
- **And** a summary card lists both tasks (FR-18)

### TS-02 — Unclear message (FR-13)
- **Given** a logged-in user
- **When** they send *"that thing"*
- **Then** the assistant asks a follow-up question and no task is created

### TS-03 — Undo an assistant reply (FR-20, NFR-21)
- **Given** an assistant reply that created 2 tasks and moved 1
- **When** the user taps *Undo* on its summary card
- **Then** both tasks are removed, the moved task returns to its original time, and the change happens in one transaction

### TS-04 — Confirmation before large change (FR-21)
- **Given** a user with 8 tasks this week
- **When** they ask *"move everything this week to next week"*
- **Then** the assistant asks for confirmation before changing anything

### TS-05 — Idempotent retry (NFR-23)
- **Given** an assistant request with request ID X that created 1 task
- **When** the same request ID X is sent again
- **Then** no new task is created

### TS-06 — Invalid scheduled time (FR-30)
- **Given** a task
- **When** the user schedules it 14:00–13:00
- **Then** the change is rejected with a clear error (NFR-17)

### TS-07 — Inbox ordering (FR-44, FR-45, FR-48)
- **Given** one overdue task, plus today's tasks at 15:00 (Low) and 09:00 (High), and another at 09:00 (Low)
- **When** the user opens the Inbox View
- **Then** the overdue task is shown first in its own section, then 09:00 High, 09:00 Low, 15:00 Low

### TS-08 — Repeating task completion (FR-41, NFR-23)
- **Given** a weekly task due Monday 2026-10-19
- **When** the user completes it (twice, e.g. via a retried request)
- **Then** exactly one next occurrence exists, due 2026-10-26

### TS-09 — Delete project, keep tasks (FR-35)
- **Given** project "Thesis" with 3 tasks
- **When** the user deletes it and chooses *move to No project*
- **Then** the project is gone and the 3 tasks appear under *No project*

### TS-10 — Reminder push (FR-56, FR-57, FR-60)
- **Given** a task scheduled at 10:00 with a "15 minutes before" reminder and notification permission granted
- **When** the time reaches 09:45
- **Then** one push notification is sent, and tapping it opens the task

### TS-11 — Authorization (NFR-11)
- **Given** user A and a task owned by user B
- **When** user A requests that task (directly or via the assistant)
- **Then** the response is 403, and a non-existent task ID returns 404

### TS-12 — AI provider down (NFR-22)
- **Given** the AI provider times out (> 15 s)
- **When** the user sends a message
- **Then** a clear error is shown, the message is kept for resend, and manual task creation still works
