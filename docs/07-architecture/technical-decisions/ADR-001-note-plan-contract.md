# ADR-001 — Every Note Produces a Plan of One Fixed Shape

**Status:** Accepted. Engine decided 2026-10-26: rules first, with a language-model fallback ([ADR-008](ADR-008-llm-fallback.md)).

## Context
The prototype understands notes with rules. v1 may add a language model for phrases the rules miss. The result screen, safety rules, undo and tests must not depend on which engine produced the result.

## Decision
- Note understanding has one output: a **plan** `{create[], update[], delete[], skipped[]}` ([note model](../../02-domain/note-model.md#plan)).
- Rules run first. The model handles only items the rules can't parse confidently, and must return the same shape through structured output ([ADR-008](ADR-008-llm-fallback.md)).
- The server validates every plan entry (field values, end after start, the task belongs to the user) and then applies the [safety rules](../../02-domain/business-rules.md#safety-rules). Nothing reaches the database except through this step.
- A fixed set of sample notes with expected plans gates every change to the rules or the model.

## Consequences
- The engine can change without touching the UI or the undo logic.
- A model can't do anything a plan can't express, which limits prompt-injection damage to wrong plans that the student sees and can undo.
- The NF-5 budget (2 s p90) has to include any model call.
