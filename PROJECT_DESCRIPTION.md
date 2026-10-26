# Project Overview
Agendal is a mobile web app (PWA) for students. You write or say whatever is on your mind, and Agendal turns it into dated, organised tasks that you can review and undo. The note comes first, and lists come second.
For example, a student writes “sql quiz monday 9am, email the group tonight, buy printer ink tomorrow”. Agendal makes three tasks: SQL quiz (Mon 09:00, High, SQL Course, reminder 1 day before), Email the group (today 20:00, Medium, reminder 15 minutes before) and Buy printer ink (tomorrow, Low). It names the note “This week” and shows exactly what it did.
The system is built around three parts:
Notes are free text, typed, dictated or read from a file. A note is written once and turned into tasks. There is no back-and-forth chat. Every note is kept in the Notes tab.
The assistant reads each note once and builds a plan: tasks to create, existing tasks to complete, reschedule or delete (“done X”, “move X to Friday”), and text to skip. It fills in dates, times, priorities, projects, repeats and reminders. It asks before risky changes (any delete, or more than five changes) and asks one question when a note has nothing to do. Every change is listed on a result screen, editable, and undoable as a whole with Undo all.
Lists show what to do. Inbox shows today, with overdue tasks first and the day’s progress at the top. Upcoming groups tasks by day, Projects groups them by course or area, and Search finds any task. A + button adds a task by hand for anyone who prefers it.
Each student has a private account. Agendal works offline: notes written without a connection wait and turn into tasks on reconnect. It installs like an app and follows the system’s light or dark theme.
# Background and Problem Statement
Students get tasks in bursts: a lecturer announces a quiz, a group chat agrees on a deadline, an errand comes up on the walk home. Most to-do apps make you stop and fill in a form for each one: title, date, time, project, priority. That friction means tasks end up in notes apps, chats or memory, and get missed.
Agendal keeps capture as cheap as writing a note. The student writes one line with several things in it, and Agendal splits it into tasks, finds the details, and shows what it did. The student stays in control, because every change is listed, editable and undoable.
The earlier concept used a chat with an assistant. It is replaced by notes, because a note is faster to write than a conversation is to manage, and the assistant only needs to speak up when a note is unclear or a change is risky.
# Pain Points
Writing a task down takes too many steps, so people skip it and forget.
Deadlines arrive in bursts and in many places, and copying each one into a form takes too long.
An assistant that changes your tasks is hard to trust unless you can see and undo what it did.
# Core Values
Capture in one note, in seconds. See what needs doing today at a glance. Stay in control: every change is visible and undoable.
