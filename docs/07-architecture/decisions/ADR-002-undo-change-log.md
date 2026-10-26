# ADR-002 — Undo Through a Per-Note Change Log

**Status:** Accepted

## Context
Undo all must reverse a whole note exactly, possibly long after it was applied ([RV-2](../../03-modules/RV-review-control.md#rv-2)), and no change may be lost ([NF-11](../../05-quality/nfr.md#nf-11)).

## Decision
- Applying a plan writes one entry per change into `notes.applied`: `{kind, task_id, before, label}`, in the same transaction as the task writes.
- Undo replays the log in reverse in one transaction. It deletes created tasks, restores `before` values on changed tasks, and restores soft-deleted tasks. The note becomes `undone`.
- Tasks deleted by a note stay soft-deleted while that note can still be undone.

## Consequences
- The result screen and the Notes tab read the same log, with no separate audit table.
- A task edited by hand after the note creates a conflict on undo. The policy ([Q9](../../08-project/open-questions.md#q9)) is in [RV §2.4](../../03-modules/RV-review-control.md#24-undo-all-rv-2-answers-to-q9-and-q10-q20).
- Edit note ([RV-5](../../03-modules/RV-review-control.md#rv-5), [Q1](../../08-project/open-questions.md#q1)) reuses the same log: it undoes the old changes, then writes a new log for the new plan.
