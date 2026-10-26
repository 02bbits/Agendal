# WF-04 — Undo a Note

**Trigger:** The user taps **Undo all** on a note's result screen. The screen is reached right after processing, or later from the Notes tab.

## Main flow

1. The note's changes are reversed using their before values ([NF-11](../05-quality/nfr.md#nf-11)). Created tasks are removed, changed tasks get their old values back, and deleted tasks are restored ([RV-2](../03-modules/RV-review-control.md#rv-2)).
2. The note is kept and marked **Undone** (status `undone`).
3. Every list updates.

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 1 | A task was edited by hand after the note | Changed fields are restored only where they still hold the note's value. Edited created tasks trigger a confirm, then are removed ([RV module §2.4](../03-modules/RV-review-control.md#24-undo-all-rv-2-answers-to-q9-and-q10-q20)) |
| 1 | More than 30 days since the note | Undo all is no longer offered ([RV-E2](../03-modules/RV-review-control.md#rv-e2)) |
| 3 | Tapped by mistake | The toast's Undo redoes the note within 10 s |
| — | The note was misread and should be fixed rather than undone | Edit note ([RV-5](../03-modules/RV-review-control.md#rv-5)): change the text and Make tasks again. The old changes are undone and the new text is planned in one step |
