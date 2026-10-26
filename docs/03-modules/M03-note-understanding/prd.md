# M03 Note Understanding — Product Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| NU-1 | Split a note into items and make one task per actionable item | Must | Items split on new lines, commas, semicolons, full stops and "then"; bullets are stripped |
| NU-2 | Fill in each task's details | Must | Due date, time, priority, project, repeat and reminder are set per the extraction rules; anything not found is left empty |
| NU-3 | Act on existing tasks from a note | Must | "done X", "move X to Friday" and "delete X" find the matching task and complete, reschedule or delete it |
| NU-4 | Ignore text that isn't a task | Must | Ideas, FYIs and filler are kept in the note but make no task; a note with nothing actionable triggers the follow-up |
| NU-5 | Ask before risky changes | Must | Any delete, or more than 5 changes in one note, shows "Check this first" with the planned changes; nothing is applied until Apply changes |
| NU-6 | Name each note automatically | Should | The name follows the naming rules and shows on the result screen and Notes card |
| NU-7 | Label tasks the assistant made | Should | Task details show "Created by the assistant" |
