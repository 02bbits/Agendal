# Project

Assumptions, constraints and risks. Decisions still open are in [open questions](open-questions.md). The build plan is in [MVP tasks](tasks.md).

## Assumptions

| ID | Assumption | If wrong |
|---|---|---|
| <a id="a1"></a>A1 | Users capture mostly on phones, in English or Vietnamese ([Q3](open-questions.md#q3)) | Wider layouts, or phrase tables for another language |
| <a id="a2"></a>A2 | Rules cover the common phrases well enough to pass the corpus gates | Lean more on the language model, behind the same plan ([ADR-001](../07-architecture/decisions/ADR-001-note-plan-contract.md)) |
| <a id="a3"></a>A3 | Browsers on the support matrix provide service workers and IndexedDB ([NF-7](../05-quality/nfr.md#nf-7)) | Offline ([AP-2](../03-modules/AP-app-platform.md#ap-2)) degrades to online only |
| <a id="a4"></a>A4 | Push on iPhone works only for installed PWAs on iOS 16.4+ | Reminders reach fewer iPhone users. Inbox still shows what is due |
| <a id="a5"></a>A5 | Device clocks are roughly correct | Per-field LWW picks the wrong value. The server clamps future timestamps |
| <a id="a6"></a>A6 | One account = one user. Nothing is shared | Shared projects need new requirements and an authorization model |
| <a id="a7"></a>A7 | **Target scale:** up to 5,000 registered users, ~2,000 weekly active, ~5,000 notes a day, on one server ([capacity model](../05-quality/scalability.md#capacity-model)) | Re-run the capacity model and add servers as listed there |
| <a id="a8"></a>A8 | Rules handle at least 80% of items. The LLM sees at most 20% | LLM cost and latency budgets in [ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md) need revisiting |

## Constraints

| Type | Constraint | Source |
|---|---|---|
| Product | Mobile web app (PWA), phones 320–480px, no native apps | PRD, [NF-7](../05-quality/nfr.md#nf-7), [NF-8](../05-quality/nfr.md#nf-8) |
| Design | Paper & ink theme, Agendal design system, WCAG 2.2 AA | [theme guide](../01-product/theme-guide.md), [NF-1](../05-quality/nfr.md#nf-1)–3 |
| Content | Sentence case, 24-hour times by default, short dates, no emoji | [NF-12](../05-quality/nfr.md#nf-12) |
| Privacy | No note or task text in logs. Files discarded after extraction | [NF-9](../05-quality/nfr.md#nf-9) |
| Academic | Course demo for VNUK *Advanced Web Development*. The course sets the schedule and team size | — |
| Hosting | One Linux server running Next.js, Laravel and PostgreSQL | [Q13](open-questions.md#q13), [Q14](open-questions.md#q14) |

## Engineering conventions

Confirmed with the stack ([Q13](open-questions.md#q13)).

| Area | Convention |
|---|---|
| Frontend | Next.js, React, TypeScript strict, ESLint and Prettier. Tailwind CSS with daisyUI, themed with the Paper & ink tokens. Components from the Agendal design system |
| Backend | Laravel, policies for authorization, business logic in services/actions, PSR-12 (Pint) |
| Database | PostgreSQL. Migrations in Laravel |
| Tests | See the [test strategy](../06-testing/test-strategy.md) |
| CI | Lint, type-check and tests on every pull request (GitHub Actions) |
| API | Versioned `/api/v1`, with generated documentation |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The assistant misreads a note (wrong date, split, or task) | Wrong tasks, and lost trust | The result screen lists every change. One-tap Undo all, or Edit note to re-plan. Each task is editable from the result |
| A command matches the wrong existing task | A task is wrongly completed, moved or deleted | 60% word-match threshold. Deletes always confirmed. Changes show the old value ("was today"). Undo all |
| Dates are ambiguous ("Friday" said on a Friday, 24-hour vs am/pm) | Tasks land on the wrong day | Weekdays always mean the next one ahead. Dates shown in full on the result. Easy edit |
| Someone types Vietnamese without diacritics | Dates and commands aren't recognised | Vietnamese is expected with diacritics. Unaccented items keep their text as the title and may go to the LLM ([NU-E40](../03-modules/NU-note-understanding.md#nu-e40)). Every task is editable from the result |
| Offline notes processed later against changed tasks | Commands act on a different state than intended | Process in order on reconnect. The same confirm rules apply. The toast reports what happened |
| PWA limits on iOS (install prompt, push notifications) | Fewer installs and reminders on iPhone | Manual install guidance in Account. Reminders are a Should, not a Must. In-app Inbox works without push |
| Uploaded files contain personal data | Privacy exposure | Extract text and discard the file ([NF-9](../05-quality/nfr.md#nf-9)). Only photos and scans go to Google Cloud Vision, inline. 5 MB limit |
| The LLM provider retains what it's sent, or is slow | Privacy exposure, or a slower result | OpenRouter routes only to providers that don't store prompts. Only low-confidence items are sent, with no identifiers. A 1.5 s timeout falls back to rules. A kill switch turns it off ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)) |
