# WF-02 — Confirm Risky Changes

**Trigger:** A plan has at least one change ([BR-01](../02-domain/business-rules.md#br-01)).

## Main flow

1. The note's status becomes `confirm`. Nothing is applied yet.
2. "Check this first" lists the planned changes ([NU-5](../03-modules/NU-note-understanding.md#nu-5)).
3. The user taps **Apply changes**. The plan is applied, the app goes back to where the note was written, and a toast says `note.made_*`.

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 3 | Edit note | Nothing changes. The note is kept (status `kept`), and the editor opens again with its text. Make tasks makes a new note |
| 1 | Offline note processed on reconnect | The same rule applies. The confirmation waits for the user ([BR-04](../02-domain/business-rules.md#br-04)) |
