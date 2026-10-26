# Assumptions

| # | Assumption | If wrong |
|---|---|---|
| A1 | Students capture mostly on phones, in English | Wider layouts or more languages ([open questions](open-questions.md)) |
| A2 | Rules cover the common phrases well enough for the MVP beta (note acceptance ≥ 85%) | Add a language model behind the same plan ([ADR-001](../07-architecture/technical-decisions/ADR-001-note-plan-contract.md)) |
| A3 | Browsers on the support matrix provide service workers and IndexedDB (NF-7) | Offline (AP-2) degrades to online only |
| A4 | Push on iPhone works only for installed PWAs on iOS 16.4+ | Reminders reach fewer iPhone users. Inbox still shows what is due |
| A5 | Device clocks are roughly correct | Per-field LWW picks the wrong value. The server clamps future timestamps |
| A6 | One account = one student. Nothing is shared | Shared projects need new requirements and an authorization model |
| A7 | **Beta scale:** up to 5,000 registered students, ~2,000 weekly active, ~5,000 notes a day ([capacity model](../05-non-functional-requirements/scalability.md#capacity-model)) | Re-run the capacity model. The design holds to ~10× before the scaling steps listed there are needed |
| A8 | Rules handle at least 80% of items. The LLM sees at most 20% | LLM cost and latency budgets in ADR-008 need revisiting |
