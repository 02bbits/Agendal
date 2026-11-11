# WF-03 — Resolve an Unclear Note

**Trigger:** A plan has nothing actionable ([NU-4](../03-modules/NU-note-understanding.md#nu-4)). For example, *"idea: dark mode for the portfolio site"*.

## Main flow

1. The note's status becomes `followup`.
2. The result screen says "I couldn't find a task in this note." and offers **Keep it as task** or **Edit the note** ([RV-3](../03-modules/RV-review-control.md#rv-3)). Until the user chooses, the note shows in the Notes tab as needing a look, named from its first words ([NU-6](../03-modules/NU-note-understanding.md#nu-6)).
3. **Keep it as task:** the note's whole text is planned as one task, and Check this first shows it (status `confirm`, [BR-01](../02-domain/business-rules.md#br-01)). Its row opens Task details, so a date can be added. Apply changes creates the task, and the status becomes `done`. It can be undone like any note.
4. **Edit the note:** the editor opens with the note's text ([RV-5](../03-modules/RV-review-control.md#rv-5)). Make tasks plans the new text. Closing the editor leaves the note in `followup`.
