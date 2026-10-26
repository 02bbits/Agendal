# WF-01 — Capture and Process a Note

**Trigger:** The user taps the capture bar or opens the Notes tab.
**Preconditions:** Signed in and online (offline: [WF-05](WF-05-offline-capture-and-sync.md)).

## Main flow

1. The full-screen editor opens with the cursor in the text. Examples show while it is empty ([NC-1](../03-modules/NC-note-capture.md#nc-1), [NC-5](../03-modules/NC-note-capture.md#nc-5)).
2. The user writes a note with several things in it ([NC-2](../03-modules/NC-note-capture.md#nc-2)), or dictates it ([NC-3](../03-modules/NC-note-capture.md#nc-3)) or attaches a file ([NC-4](../03-modules/NC-note-capture.md#nc-4)). Dictated or extracted text lands in the editor to check first.
3. The user taps **Make tasks**, which is enabled as soon as there is text.
4. The assistant splits the note into items ([NU-1](../03-modules/NU-note-understanding.md#nu-1)), extracts each item's fields ([NU-2](../03-modules/NU-note-understanding.md#nu-2)), matches commands to existing tasks ([NU-3](../03-modules/NU-note-understanding.md#nu-3)), and skips non-tasks ([NU-4](../03-modules/NU-note-understanding.md#nu-4)).
5. The plan is safe: no delete and at most 5 changes. It is applied, and each change is stored with its before values ([NF-11](../05-quality/nfr.md#nf-11)).
6. The result screen shows the time · "N tasks made", the generated name ([NU-6](../03-modules/NU-note-understanding.md#nu-6)), "From \<file>" if any, the original note as a quote, and one row per change with a CREATED / UPDATED / DELETED badge ([RV-1](../03-modules/RV-review-control.md#rv-1)). All of this appears within 2 s for up to 10 items ([NF-5](../05-quality/nfr.md#nf-5)).
7. The user taps a row to edit that task ([TK-2](../03-modules/TK-tasks.md#tk-2)), or taps **Done**. The note appears in the Notes tab ([RV-4](../03-modules/RV-review-control.md#rv-4)).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 5 | Any delete, or more than 5 changes | [WF-02](WF-02-confirm-risky-changes.md) |
| 4 | Nothing actionable | [WF-03](WF-03-resolve-unclear-note.md) |
| 6 | The result is wrong | [WF-04](WF-04-undo-a-note.md) |
| 2 | File unsupported or over 5 MB | A specific error, e.g. "Attach a file under 5 MB." ([NC-4](../03-modules/NC-note-capture.md#nc-4)) |
| 2 | Listening | "Listening…" with Stop. Make tasks is disabled while listening ([NC-3](../03-modules/NC-note-capture.md#nc-3)) |
