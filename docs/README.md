# About

Agendal is a mobile web app (PWA). You write or say whatever is on your mind, in English or Vietnamese, and Agendal turns it into dated, organised tasks that you can review and undo. **The note comes first; lists come second.** It is a course demo project.

> **V2 concept (Oct 23, 2026).** The earlier chat with an assistant is replaced by **notes**. A note is written once and turned into tasks; there is no back-and-forth conversation. The source PRD is `Agendal-PRD-V2.md`. The V1 docs are in git history (commit `5ad132a`).

## Reading order

| Folder | What it answers |
|---|---|
| [01-product](01-product/) | Why Agendal exists, for whom, and what's in v1 ([overview](01-product/overview.md)). [Screens](01-product/screens.md), [UX standards](01-product/ux-standards.md), [copy catalog](01-product/copy-catalog.md), [theme guide](01-product/theme-guide.md) |
| [02-domain](02-domain/) | Vocabulary, the note and task models, note lifecycle ([domain](02-domain/domain.md)), and the [business rules](02-domain/business-rules.md) that turn notes into tasks |
| [03-modules](03-modules/) | The 43 functional requirements, one file per module. Each file holds the requirements, then the full spec: behaviour, states, edge cases, API and tests |
| [04-workflows](04-workflows/) | End-to-end flows that cross modules |
| [05-quality](05-quality/) | [Non-functional requirements](05-quality/nfr.md) and [scalability](05-quality/scalability.md) |
| [06-testing](06-testing/) | [Test strategy](06-testing/test-strategy.md), [scenarios](06-testing/test-scenarios.md), [traceability](06-testing/traceability-matrix.md), [ASVS checklist](06-testing/asvs-checklist.md), [note corpus](06-testing/note-corpus/) |
| [07-architecture](07-architecture/) | [Overview](07-architecture/overview.md), [data model](07-architecture/data-model.md), [API](07-architecture/api.md) and its [contracts](07-architecture/contracts/) (JSON Schemas and fixtures), [security](07-architecture/security.md), [decisions](07-architecture/decisions/) |
| [08-project](08-project/) | [Assumptions, constraints and risks](08-project/project.md), [open questions](08-project/open-questions.md), [glossary](08-project/glossary.md), [MVP tasks](08-project/tasks.md) |

## Modules

Each module has one code. It is the prefix of the module's file, its requirements ([NU-1](03-modules/NU-note-understanding.md#nu-1)), its edge cases ([NU-E1](03-modules/NU-note-understanding.md#nu-e1)) and its tests (T-NU-01).

| Code | Module | Requirements |
|---|---|---|
| AA | [Account & Access](03-modules/AA-account-access.md) | [AA-1](03-modules/AA-account-access.md#aa-1)–5 |
| NC | [Note Capture](03-modules/NC-note-capture.md) | [NC-1](03-modules/NC-note-capture.md#nc-1)–7 |
| NU | [Note Understanding](03-modules/NU-note-understanding.md) | [NU-1](03-modules/NU-note-understanding.md#nu-1)–7 |
| RV | [Review & Control](03-modules/RV-review-control.md) | [RV-1](03-modules/RV-review-control.md#rv-1)–5 |
| TK | [Tasks](03-modules/TK-tasks.md) | [TK-1](03-modules/TK-tasks.md#tk-1)–6 |
| LV | [Lists & Search](03-modules/LV-lists-search.md) | [LV-1](03-modules/LV-lists-search.md#lv-1)–4 |
| PJ | [Projects](03-modules/PJ-projects.md) | [PJ-1](03-modules/PJ-projects.md#pj-1)–4 |
| AP | [App & Platform](03-modules/AP-app-platform.md) | [AP-1](03-modules/AP-app-platform.md#ap-1)–5 |

## ID lookup

Every ID in the docs is a link to the place it's defined. A file name carries a code only when the file *is* that item (a module, a workflow, an ADR).

| ID | Example | What it is | Defined in |
|---|---|---|---|
| `AA`–`AP` + number | [NU-3](03-modules/NU-note-understanding.md#nu-3) | Functional requirement | The module's file, **Requirements** table |
| Module code + `E` + number | [NU-E11](03-modules/NU-note-understanding.md#nu-e11) | Edge case | The module's file, section 4 |
| `NF` | [NF-5](05-quality/nfr.md#nf-5) | Non-functional requirement | [nfr.md](05-quality/nfr.md) |
| `BR` | [BR-01](02-domain/business-rules.md#br-01) | Business rule | [business-rules.md](02-domain/business-rules.md) |
| `WF` | [WF-04](04-workflows/WF-04-undo-a-note.md) | Workflow | [04-workflows](04-workflows/), one file each |
| `ADR` | [ADR-008](07-architecture/decisions/ADR-008-llm-fallback.md) | Architecture decision | [decisions](07-architecture/decisions/), one file each |
| `UX` | [UX-32](01-product/ux-standards.md#ux-32) | Interaction standard | [ux-standards.md](01-product/ux-standards.md) |
| `SC` | [SC-13](07-architecture/security.md#sc-13) | Security control | [security.md](07-architecture/security.md) |
| `A` | [A7](08-project/project.md#a7) | Assumption | [project.md](08-project/project.md#assumptions) |
| `Q` | [Q19](08-project/open-questions.md#q19) | Question, open or decided | [open-questions.md](08-project/open-questions.md) |
| `TS` | [TS-07](06-testing/test-scenarios.md#ts-07) | Test scenario (Given/When/Then) | [test-scenarios.md](06-testing/test-scenarios.md) |
| `T-`, `SEC`, `PERF`, `A11Y`, `OFF` | T-RV-101 | Automated test | Listed in each module's section 11 ([test IDs](06-testing/test-strategy.md#test-ids)) |
| `IM` | [IM-37](08-project/tasks.md#im-37) | Implementation task for the MVP | [tasks.md](08-project/tasks.md) |
| `C` | C-044 | Note-corpus case | [seed.yaml](06-testing/note-corpus/seed.yaml) |

IDs are never reused. A retired ID stays retired.

## Definition of Ready and Done

**Ready to build:** the module file has every section of the [template](03-modules/_template.md) filled (or marked "None" with a reason), every edge case has a decision and a test ID, every new string is in the copy catalog, and the questions it depends on are closed.

**Done:** see the [test strategy](06-testing/test-strategy.md#definition-of-done-per-feature). Every acceptance criterion, edge case and state has a passing test with its ID, the authorization-matrix rows pass, copy matches the catalog, and axe is clean.

## Conventions

- Requirements live in exactly one place (their module file, or nfr.md). Everything else links to them.
- Example account in every doc: example@gmail.com ("example"), with projects SQL Course, Adv Web, HCI, Portfolio and Personal. "Today" in examples is Fri 23 Oct 2026.

# Collaboration
%% To be filled %%
