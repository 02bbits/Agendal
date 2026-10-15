# Goals and Non-Goals

## Goals

| ID | Goal | Measured by |
|---|---|---|
| G1 | Capture tasks with almost no effort | First task within one message or 3 taps (NFR-14); ≥ 90% extraction accuracy (NFR-15) |
| G2 | Make today's priorities obvious | Inbox View as home screen, overdue first, progress shown (FR-43–48); loads ≤ 3 s (NFR-1) |
| G3 | Stop tasks slipping | Reminders (FR-56–60), nudges and morning summary (FR-53–54) |
| G4 | Help users plan *when* to work | Free-slot suggestions (FR-16), scheduling (FR-29) |
| G5 | Keep users motivated | Encouragement on completion (FR-52), daily progress (FR-46) |
| G6 | Keep users in control of the AI | Summary card, edit, single-action undo, confirmations (FR-18–21) |
| G7 | Private, available on every device | Per-user accounts and authorization (FR-01–05, NFR-11), installable PWA (FR-65) |

## Non-goals

None of the following appears in the current requirements. Each would need a new FR before work starts.

- Shared projects, collaboration, or assigning tasks to other people (Agendal is single-user).
- Two-way sync with external calendars (Google Calendar, Outlook).
- Native app-store apps (the PWA covers installation).
- File attachments on tasks.
- The assistant acting without showing what it changed (every data change gets a summary card).
- Using the assistant while offline (FR-67 shows it as unavailable).
