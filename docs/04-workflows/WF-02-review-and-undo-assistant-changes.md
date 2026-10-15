# WF-02 — Review and Undo Assistant Changes

**Trigger:** An assistant reply changed data.
**Actors:** User.
**Preconditions:** The reply has a summary card (FR-18).

## Main flow

1. The user reads the summary card: tasks created, changed, and deleted.
2. **Edit:** the user opens a listed task and corrects a field (FR-19). This is a normal manual edit (FR-24).
3. **Undo:** the user taps *Undo*. Every change from that reply is reverted in one transaction (FR-20, NFR-21).
4. Feedback is shown (NFR-17), and all views update (FR-51).

## Alternatives

| At | Condition | Behaviour |
|---|---|---|
| 3 | A task in the change set was edited manually after the reply | See [open questions](../08-project/open-questions.md) (overwrite or refuse) |
| 3 | Undo fails | Rolled back fully, error shown, nothing partially reverted |

**Postconditions:** Data matches the state before the reply (undo), or the user's correction (edit).
