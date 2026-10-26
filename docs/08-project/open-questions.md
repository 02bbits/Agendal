# Open Questions

## From the PRD

| # | Question | Affects | Status |
|---|---|---|---|
| Q1 | Should editing a saved note re-plan it (and update its tasks), or stay read-only as in the prototype? | RV-4, ADR-002 | Open |
| Q2 | Rules only, or rules plus a language model for note understanding in v1? This decides cost, latency and offline behaviour | M03, NF-5, ADR-001 | **Closed 2026-10-26:** rules first, LLM fallback ([ADR-008](../07-architecture/technical-decisions/ADR-008-llm-fallback.md)) |
| Q3 | Which languages besides English does v1 need to understand (e.g. Vietnamese dates and times)? | M03 rules | Open |
| Q4 | Should the follow-up question also offer "Ask me when" for items with no date, instead of leaving the date empty? | RV-3 | Open |
| Q5 | Is the 5-change confirmation threshold right, or should it scale with how sure the assistant is? | NU-5 | Open |
| Q6 | Week start (Monday or Sunday) and 12- vs 24-hour time: fixed, or a setting? | NF-12, M03 | Open |
| Q7 | Account deletion and data export: required for launch? | M01, NF-9 | Open |
| Q8 | The metric targets are proposals. Confirm them before the beta | Goals | Open |

## Added while splitting the docs

| # | Question | Affects | Status |
|---|---|---|---|
| Q9 | Undo all after a task from the note was edited by hand: overwrite the edit, skip that task, or refuse? | RV-2, ADR-002 | **Closed 2026-10-26:** approved, per the [M04 spec](../03-modules/M04-review-control/spec.md#24-undo-all-rv-2-answers-to-q9-and-q10-q20): restore only fields still holding the note's value; edited created tasks → confirm, then remove |
| Q10 | How long can a note be undone (forever, or a time window)? Soft-deleted tasks are kept until then | RV-2, data model | **Closed 2026-10-26:** approved, per the M04 spec: 30 days, matching the tombstone purge |
| Q11 | Dictation: the browser's Web Speech API, or a server speech service? | NC-3, NF-9 | **Closed 2026-10-26:** approved, per the [M02 spec](../03-modules/M02-note-capture/spec.md#23-dictation-nc-3-should): Web Speech API, with a one-time privacy notice |
| Q12 | Which text-extraction / OCR service handles PDF, Word and photos? | NC-4 | Open |
| Q13 | Tech stack and conventions are carried over from V1 (Next.js + Laravel). Still the plan? | Architecture, constraints | Open (the specs assume yes) |
| Q14 | Which DBMS and hosting? | Data model, deployment | Open |
| Q15 | The theme guide uses UPDATED as the badge for a changed task, but the PRD uses CHANGED. Which one? | RV-1, theme guide | Open |

## Added by the production-readiness plan

| #   | Question                                                                                                                                                                                                                                                                                                                                   | Affects                                                        | Status                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------- |
| Q16 | Approve the proposed ADR-005 (sync), ADR-006 (time zones), ADR-007 (session) and ADR-008 (LLM fallback)                                                                                                                                                                                                                                    | Architecture, every spec                                       | Open                                           |
| Q17 | Approve the M03 edge-case decisions, including two proposed PRD changes: unmatched *delete/complete* commands are skipped instead of becoming tasks, ties ask the student to pick, and comma lists after a verb merge into one task (E33)                                                                                                  | NU-3, [M03 spec](../03-modules/M03-note-understanding/spec.md) | **Closed 2026-10-26:** approved with the pilot |
| Q18 | Password minimum: the PRD says 8 characters, OWASP ASVS L2 says 12. Keep 8 with a breached-password check, or raise to 12?                                                                                                                                                                                                                 | AA-1, [ASVS checklist](../06-acceptance/asvs-checklist.md)     | Open                                           |
| Q19 | Which LLM provider? It needs structured output, a no-retention / no-training option, and p90 latency under 1.5 s                                                                                                                                                                                                                           | ADR-008                                                        | Open                                           |
| Q20 | Approve the module-spec decisions marked **(Q20)** that extend the PRD: partial apply in Check this first, redo after Undo all (M04); dictation notice, New-task defaults by entry point (M02); next occurrence from the due date skipping missed ones (M05); Inbox **No date** section (M06); three-way Appearance, conflict notice (M08) | M02, M04–M06, M08 specs                                        | **Closed 2026-10-26:** approved                |
