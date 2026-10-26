# Actors and Roles

## Users

The primary user is a university student juggling courses, group projects and personal errands, mostly on their phone.

| User | Context | Needs | What Agendal does |
|---|---|---|---|
| Busy student (primary) | Several courses, each with quizzes, reports and group work. Captures on the go between classes | Get things out of their head in seconds. See what is due today. Never miss a deadline | Notes in, tasks out. Inbox shows today and overdue. Reminders before quizzes and timed tasks |
| Group-project member | Deadlines agreed in chats and meetings | Turn meeting notes into dated tasks | Paste or attach the notes. Agendal makes one task per action item |
| Planner | Prefers to set every field by hand | Full control over each task | The + button opens a manual New task sheet. Every field is editable afterwards |
| Low-vision or keyboard user | Uses large text, a screen reader or a keyboard | Readable contrast, labelled controls, visible focus | WCAG 2.2 AA colours, 44px targets, labelled icon buttons, focus rings |

## Roles

| Role | Can do |
|---|---|
| Guest | Create an account, sign in, reset a password (AA-1–4) |
| Account holder | Everything, on **their own** notes, tasks and projects only (NF-9) |

There is no admin or support role in v1.

## System actors

| Actor | Role |
|---|---|
| Assistant (note understanding) | Reads a note once and builds a plan. Applies it only within the safety rules ([BR](../02-domain/business-rules.md#safety-rules)) |
| Device (service worker) | Keeps lists, edits and pending notes offline, and syncs on reconnect (NF-6) |
| Email service | Sends password-reset links (AA-4) |
| Web Push | Delivers reminders (TK-6, Should) |
