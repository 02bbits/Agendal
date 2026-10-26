# About

Agendal is a mobile web app (PWA) for students. You write or say whatever is on your mind, and Agendal turns it into dated, organised tasks that you can review and undo. **The note comes first; lists come second.**

> **V2 concept (Oct 23, 2026).** The earlier chat with an assistant is replaced by **notes**. A note is written once and turned into tasks; there is no back-and-forth conversation. The source PRD is `Agendal-PRD-V2.md`. The V1 docs are in git history (commit `5ad132a`).

## Reading order (docs)

| Folder | What it answers |
|---|---|
| [01-product](01-product/) | Why Agendal exists, for whom, goals and metrics, screens, scope, theme, [UX standards](01-product/ux-standards.md), [copy catalog](01-product/copy-catalog.md) |
| [02-domain](02-domain/) | Vocabulary, the note and task models, note lifecycle, and the rules that turn notes into tasks |
| [03-modules](03-modules/) | Functional requirements (41), one folder per area. Each has a `prd.md` (what) and a `spec.md` (how, in detail: states, edge cases, API, tests) |
| [04-workflows](04-workflows/) | End-to-end flows that cross modules |
| [05-non-functional-requirements](05-non-functional-requirements/) | Quality targets NF-1–NF-12 from the PRD, NF-13–21 added in the docs, scalability and SLOs, analytics |
| [06-acceptance](06-acceptance/) | Test strategy, golden note corpus, ASVS checklist, scenarios, traceability |
| [07-architecture](07-architecture/) | System design, data model, API, [threat model](07-architecture/threat-model.md), technical decisions (ADRs) |
| [08-project](08-project/) | Assumptions, constraints, risks, open questions, glossary |

## Modules

| ID | Module | Requirements |
|---|---|---|
| M01 | [Account & Access](03-modules/M01-account-access/) | AA-1–5 |
| M02 | [Note Capture](03-modules/M02-note-capture/) | NC-1–7 |
| M03 | [Note Understanding](03-modules/M03-note-understanding/) | NU-1–7 |
| M04 | [Review & Control](03-modules/M04-review-control/) | RV-1–4 |
| M05 | [Tasks](03-modules/M05-tasks/) | TK-1–6 |
| M06 | [Lists & Search](03-modules/M06-lists-search/) | LV-1–4 |
| M07 | [Projects](03-modules/M07-projects/) | PJ-1–4 |
| M08 | [App & Platform](03-modules/M08-app-platform/) | AP-1–4 |

## Definition of Ready and Done

**Ready to build:** the feature's module `spec.md` has every section of the [spec template](03-modules/_spec-template.md) filled (or marked "None" with a reason), every edge case has a decision and a test ID, every new string is in the copy catalog, and the open questions it depends on are closed.

**Done:** see the [test strategy](06-acceptance/test-strategy.md#definition-of-done-per-feature). Every acceptance criterion, edge case and state has a passing test with its ID, the authorization-matrix rows pass, copy matches the catalog, axe is clean, and analytics carry no text.

## Conventions

- Requirement IDs come from the PRD: `AA`, `NC`, `NU`, `RV`, `TK`, `LV`, `PJ`, `AP` (functional) and `NF` (non-functional). Docs-only IDs: `BR-nn` (business rules), `WF-nn`, `TS-nn`, `ADR-nnn`. Never reuse a retired ID.
- Spec and test IDs: `En` (edge case within a module spec), `UX-nn` (UX standards), `SC-nn` (security control), and test IDs `T-<AREA>-nn`, `SEC-nn`, `PERF-nn`, `A11Y-nn`, `OFF-nn`, `C-nnn` ([test strategy](06-acceptance/test-strategy.md#test-ids)). Edge case `En` in a module is tested by `T-<AREA>-1nn`.
- Requirements live in exactly one place (the module `prd.md` or the NFR file); everything else links to them.
- Example account in every doc: example@gmail.com ("example"), with projects SQL Course, Adv Web, HCI, Portfolio and Personal.

# Collaboration
%% To be filled %%
