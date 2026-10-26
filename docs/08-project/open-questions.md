# Open Questions

Decisions the docs depend on. A closed question keeps its row, so links to it still work. [Q1](#q1)–[Q8](#q8) came from the PRD; the rest came up while writing the docs.

## Open

None.

## Closed

| ID | Question | Decision (2026-10-26 unless noted) |
|---|---|---|
| <a id="q1"></a>Q1 | Should editing a saved note re-plan it, or stay read-only as in the prototype? | **Re-plan.** Edit note undoes what the note applied and plans the new text under the same safety rules ([RV-5](../03-modules/RV-review-control.md#rv-5)) |
| <a id="q2"></a>Q2 | Rules only, or rules plus a language model? | Rules first, with a language-model fallback ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)) |
| <a id="q3"></a>Q3 | Which languages does v1 need to understand? | **English and Vietnamese**, in notes only. The UI stays English ([business rules](../02-domain/business-rules.md#vietnamese-q3)) |
| <a id="q4"></a>Q4 | Should the app offer "Ask me when" for items with no date? | **Yes.** Created tasks with no date show When? chips on the result screen ([RV §2.1](../03-modules/RV-review-control.md#21-result-screen-rv-1)) |
| <a id="q5"></a>Q5 | Is the 5-change confirmation threshold right? | **Keep 5.** A change is one task the note creates, updates (completes or reschedules) or deletes. Skipped text doesn't count |
| <a id="q6"></a>Q6 | Week start and 12- vs 24-hour time: fixed, or a setting? | **A setting** in Account. Defaults: Monday and 24-hour ([AP-5](../03-modules/AP-app-platform.md#ap-5)) |
| <a id="q7"></a>Q7 | Account deletion and data export for the first release? | **Neither.** Moved to Later ([release plan](../01-product/overview.md#release-plan)) |
| <a id="q8"></a>Q8 | Confirm the metric targets | **Dropped.** Agendal is a demo project, so it has no success metrics or product analytics |
| <a id="q9"></a>Q9 | Undo all after a task from the note was edited by hand | Restore only fields that still hold the note's value. Edited created tasks → confirm, then remove ([RV §2.4](../03-modules/RV-review-control.md#24-undo-all-rv-2-answers-to-q9-and-q10-q20)) |
| <a id="q10"></a>Q10 | How long can a note be undone? | 30 days, matching the tombstone purge |
| <a id="q11"></a>Q11 | Dictation: Web Speech API or a server service? | Web Speech API, with a one-time privacy notice ([NC §2.3](../03-modules/NC-note-capture.md#23-dictation-nc-3-should)) |
| <a id="q12"></a>Q12 | Which text-extraction / OCR service? | **Google Cloud Vision** for photos and scanned PDFs. Text PDFs and Word files are read on the server ([NC §2.4](../03-modules/NC-note-capture.md#24-file-to-note-nc-4-should)) |
| <a id="q13"></a>Q13 | Tech stack | **Next.js + Laravel**, as the docs assumed ([architecture](../07-architecture/overview.md)) |
| <a id="q14"></a>Q14 | Which database and hosting? | **PostgreSQL on one Linux server** ([deployment](../07-architecture/overview.md#deployment)) |
| <a id="q15"></a>Q15 | Badge for a changed task: UPDATED or CHANGED? | **UPDATED** |
| <a id="q16"></a>Q16 | Approve [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md) (sync), [ADR-006](../07-architecture/decisions/ADR-006-time-zones.md) (time zones), [ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md) (session) and [ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md) (LLM fallback) | **Approved.** All four are Accepted |
| <a id="q17"></a>Q17 | Approve the NU edge-case decisions (unmatched complete/delete skipped, ties ask, comma lists after a verb merge) | Approved with the NU pilot ([NU edge cases](../03-modules/NU-note-understanding.md#4-edge-cases)) |
| <a id="q18"></a>Q18 | Password minimum: 8 (PRD) or 12 (ASVS L2)? | **8**, with the breached-password check ([ASVS 2.1.1](../06-testing/asvs-checklist.md#v2-authentication)) |
| <a id="q19"></a>Q19 | Which LLM provider? | **OpenRouter** with Structured Outputs, routed only to providers that don't store prompts. Changed from DeepSeek the same day ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)) |
| <a id="q20"></a>Q20 | Approve the module decisions marked (Q20) that extend the PRD | Approved |
| <a id="q21"></a>Q21 | Approve the two remaining ASVS deviations: the search query stays in the URL (8.3.1), and no malware scan for uploads (12.4.2) | **Approved** ([ASVS checklist](../06-testing/asvs-checklist.md#deviations)) |
