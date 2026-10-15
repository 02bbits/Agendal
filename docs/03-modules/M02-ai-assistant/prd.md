# M02 AI Assistant — Product Requirements

## Creating tasks

| ID | Requirement | Rationale | Priority |
|---|---|---|---|
| FR-07 | The system shall allow a user to send a message to the assistant by typing. | Removes the need to fill in forms. | High |
| FR-08 | The system shall allow a user to send a message by speaking, and shall show the transcribed text so the user can correct it before sending. | Faster capture on mobile; prevents tasks built from misheard words. | High |
| FR-09 | The assistant shall identify every task in a message and create one task for each. | One message often contains several tasks. | High |
| FR-10 | The assistant shall convert relative dates and times, such as “tonight”, “next Friday”, or “end of the month”, into exact dates and times in the user’s time zone. | Users describe deadlines the way they speak. | High |
| FR-11 | The assistant shall assign a due date, scheduled time, priority, and reminder to each task when the message gives enough information to infer them. | Saves users from setting each field by hand. | High |
| FR-12 | The assistant shall assign a task to an existing project when the message names or clearly refers to that project. | Keeps tasks organised without extra steps. | Medium |
| FR-13 | The assistant shall ask a short follow-up question when a message is too unclear to create a task. | Avoids creating wrong tasks. | Medium |

## Managing tasks

| ID | Requirement | Rationale | Priority |
|---|---|---|---|
| FR-14 | The assistant shall move, update, complete, or delete existing tasks when the user asks in a message. | Lets users manage their list by conversation. | High |
| FR-15 | The assistant shall split a task into smaller tasks when the user asks. | Large tasks are easier to start in smaller steps. | Medium |
| FR-16 | The assistant shall suggest free time slots for tasks that have no scheduled time, avoiding times already scheduled, and schedule a task when the user accepts a slot. | Users know when work is due but not when they will do it. | Medium |
| FR-17 | The assistant shall answer questions about the user’s tasks, such as “What should I do next?”, based on priority, due date, and scheduled time. | Makes daily priorities clear. | Medium |

## Review and control

| ID | Requirement | Rationale | Priority |
|---|---|---|---|
| FR-18 | After each reply that changes data, the assistant shall show a summary card listing every task it created, changed, or deleted. | Users can check what the assistant did. | High |
| FR-19 | The system shall allow a user to open and edit any task listed on a summary card. | Corrects details the assistant got wrong. | High |
| FR-20 | The system shall allow a user to undo all changes from one assistant reply with a single action. | Users stay in control. | High |
| FR-21 | The assistant shall ask for confirmation before deleting any task or changing more than five tasks in one reply. | Prevents large mistakes from a misunderstood message. | High |
| FR-22 | The system shall keep the conversation history and show it when the user returns to the assistant. | Gives context for earlier changes. | Low |
