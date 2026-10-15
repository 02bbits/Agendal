# Actors and Roles

## Human actors

| Actor | Description | Permissions |
|---|---|---|
| Guest | Not logged in | Register, log in, reset password (FR-01–04) |
| User | Registered account owner | Full control of **their own** tasks, projects, conversation, and preferences. No access to anyone else's data (NFR-11) |

There is no administrator or support role in the current requirements (see [open questions](../08-project/open-questions.md)).

## System actors

| Actor | Role |
|---|---|
| AI assistant | Acts **on behalf of** the user, only through a fixed set of server-side actions, under the same authorization policies as the user (NFR-11, NFR-13) |
| Scheduler / queue workers | Send reminders, nudges, and morning summaries, and create next occurrences (NFR-5) |

## External systems

| System | Used for |
|---|---|
| AI (LLM) provider | Understanding messages, extracting tasks, answering questions |
| Speech-to-text service | Transcribing voice messages (FR-08) |
| Mail service | Password-reset links (FR-04) |
| Web Push service | Reminders, nudges, morning summary (FR-57) |
