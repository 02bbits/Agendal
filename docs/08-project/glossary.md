# Glossary

Technical terms and acronyms. For domain terms (note, plan, change, …), see [terminology](../02-domain/domain.md#terminology).

| Term | Meaning |
|---|---|
| AA, NC, BR, … | IDs. Every ID prefix is explained in the [ID lookup](../README.md#id-lookup) |
| Must / Should / Could | v1 / v1 if time allows (else v1.1) / later |
| PWA | Progressive Web App: a website that installs like an app and works offline |
| Service worker | A browser background script for caching, offline use and push |
| IndexedDB | The browser's on-device database, used for offline data |
| LWW | Last write wins: on conflict, the newest change is kept (per field here) |
| Idempotency | Sending the same request twice has the same effect as once |
| OCR | Reading text from a photo or scanned page (Google Cloud Vision here) |
| LLM | Large language model (through OpenRouter here), used only as a fallback for notes the rules can't read |
| Diacritics | Vietnamese accent marks (ă, ê, ơ, ́ …). Vietnamese notes are expected to have them ([business rules](../02-domain/business-rules.md#vietnamese-q3)) |
| p90 | The 90th percentile: 9 out of 10 cases are at or under the value |
| WCAG 2.2 AA | Web Content Accessibility Guidelines, level AA |
| `100dvh` | CSS unit for the full dynamic viewport height on mobile |
