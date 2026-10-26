# WF-02 — Confirm Risky Changes

**Trigger:** A plan has any delete, or more than 5 changes ([BR-01](../02-domain/business-rules.md#br-01)).

## Main flow

1. The note's status becomes `confirm`. Nothing is applied yet.
2. "Check this first" lists the planned changes ([NU-5](../03-modules/NU-note-understanding.md#nu-5)).
3. The user taps **Apply changes**. The plan is applied, and the flow continues at [WF-01](WF-01-capture-and-process-note.md) step 6.

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 3 | Cancel | Nothing changes. The note is kept (status `kept`) |
| 1 | Offline note processed on reconnect | The same rule applies. The confirmation waits for the user ([BR-04](../02-domain/business-rules.md#br-04)) |
