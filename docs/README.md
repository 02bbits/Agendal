# Agendal — Documentation

Agendal is a mobile-first PWA for personal task management, built around an AI assistant that turns plain-language messages (typed or spoken) into organised, scheduled tasks.

## Reading order

| Folder | What it answers |
|---|---|
| [01-product](01-product/) | Why Agendal exists, for whom, and what is in scope |
| [02-domain](02-domain/) | The vocabulary, the task model, its lifecycle, and the business rules |
| [03-modules](03-modules/) | Functional requirements (FR-01–FR-67), one folder per module |
| [04-workflows](04-workflows/) | End-to-end user flows that cross modules |
| [05-non-functional-requirements](05-non-functional-requirements/) | Quality targets (NFR-1–NFR-27) |
| [06-acceptance](06-acceptance/) | How requirements are verified and traced |
| [07-architecture](07-architecture/) | System design and technical decisions (ADRs) |
| [08-project](08-project/) | Assumptions, constraints, open questions, glossary |

## Modules

| ID | Module | FRs |
|---|---|---|
| M01 | [Identity & Access](03-modules/M01-identity-access/) | FR-01–06 |
| M02 | [AI Assistant](03-modules/M02-ai-assistant/) | FR-07–22 |
| M03 | [Task Management](03-modules/M03-task-management/) | FR-23–32 |
| M04 | [Projects](03-modules/M04-projects/) | FR-33–38 |
| M05 | [Recurrence](03-modules/M05-recurrence/) | FR-39–42 |
| M06 | [Inbox & Views](03-modules/M06-inbox-and-views/) | FR-43–51 |
| M07 | [Motivation](03-modules/M07-motivation/) | FR-52–55 |
| M08 | [Reminders](03-modules/M08-reminders/) | FR-56–60 |
| M09 | [Search & Filter](03-modules/M09-search-filter/) | FR-61–64 |
| M10 | [PWA & Offline](03-modules/M10-pwa-offline/) | FR-65–67 |

## Conventions

- IDs are stable: `FR-nn`, `NFR-n`, `BR-nn` (business rules), `WF-nn`, `TS-nn` (test scenarios), `ADR-nnn`. Never reuse a retired ID.
- Requirements live in exactly one place (the module `prd.md` or the NFR file); everything else links to them.
