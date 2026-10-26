# Observability

## Analytics events

Events carry counts and categories only, **never note or task text** (NF-9).

The PRD events are below. Each module spec adds its own events in section 11 (for example `note_redone`, `sync_completed`, `reminder_sent`), with the same rule: no free text.

| Event | When | Properties | Feeds metric |
|---|---|---|---|
| note\_editor\_opened | Editor opens | entry (capture bar, Notes, mic) | Time to capture |
| note\_submitted | Make tasks or Save note | input (typed, voice, file), file type, characters, offline | Time to capture |
| note\_processed | Plan built | creates, updates, deletes, skipped, status (done, confirm, followup), ms | Follow-up rate |
| note\_confirmed / note\_cancelled | Apply changes / Cancel on a confirm | changes | — |
| note\_undone | Undo all | minutes since processed | Note acceptance |
| task\_created | Any new task | source (note, manual), has due, has time, has project | Note-to-task share |
| task\_edited | Field changed in details | field, assistant-made | Edit rate |
| task\_completed | Checkbox ticked | assistant-made, overdue, repeating | Completion |
| app\_installed | PWA installed | entry (banner, Account) | Install rate |
| session\_started | App opened | online, installed | Weekly retention |

## Operational logging

The PRD sets no requirements here. These are carried over from V1 and need confirming ([open questions](../08-project/open-questions.md)):

- Server errors and slow queries are logged and alert the team.
- Note processing logs duration (for NF-5) and plan counts, never text.
