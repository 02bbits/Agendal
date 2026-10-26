# Test Strategy

**Goal:** every acceptance criterion, edge case and security control has an automated test, and CI blocks a merge that breaks any of them.

## Test IDs

| Prefix | What | Defined in |
|---|---|---|
| `T-<AREA>-nn` (e.g. `T-NU-07`) | Functional and edge-case tests | Each module's `spec.md`, section 12 |
| `SEC-nn` | Security controls | [threat model](../07-architecture/threat-model.md), [security NFRs](../05-non-functional-requirements/security.md) |
| `PERF-nn` | Load and latency | [scalability](../05-non-functional-requirements/scalability.md#load-test-plan) |
| `A11Y-nn` | Accessibility | Specs, section 6 |
| `OFF-nn` | Offline and sync end-to-end | Specs (M02, M08), ADR-004/005 |
| `C-nnn` | Golden note-corpus cases | [note-corpus/](note-corpus/) |

Write the test ID in the test name (`it('T-NU-07 tonight after 20:00 has no time')`), so the traceability matrix can be checked by a script.

## Levels and tools

| Level | Scope | Tools (assumes Q13: Next.js + Laravel) | Runs |
|---|---|---|---|
| Unit | Note engine (split, extract, match, name, safety), date math, validators, reducers | Pest (PHP engine), Vitest (client helpers) | Every push |
| Corpus | Whole-note plans against the golden set, in rules mode and rules + LLM mode (LLM mode: nightly and on prompt/model change, against the real provider) | Pest data provider over `note-corpus/*.yaml` | Every push (rules), nightly (LLM) |
| API / integration | Endpoints with a real DB: validation, authorization matrix, rate limits, idempotency, undo, sync | Pest + Laravel HTTP tests, a fresh DB per test | Every push |
| Component | Screens and components in every state of the spec's state matrix | Vitest + React Testing Library | Every push |
| End-to-end | Workflows WF-01–07 in a real browser, including offline (`context.setOffline`) and two-device sync | Playwright (Chromium, WebKit, Firefox; mobile viewport 360×800) | Every PR |
| Accessibility | axe on every screen and state, keyboard-only paths | @axe-core/playwright. Manual VoiceOver/TalkBack pass before each release | Every PR (axe), release (manual) |
| Security | Authorization matrix, CSRF, headers, upload abuse, rate limits | Pest + Playwright, OWASP ZAP baseline against staging, `composer audit`, `npm audit`, secret scan | Every PR. ZAP nightly |
| Performance | PERF-01–05 | k6 against staging. Lighthouse CI for NF-4 | Nightly + before release |

## CI gates (merge blocked if any fail)

1. Lint, format, and type-check (PHP and TypeScript strict).
2. Unit, corpus (rules mode), API and component tests are 100% green.
3. Every acceptance criterion in every `prd.md` maps to at least one test ID that exists in the test suite (traceability script).
4. Backend line coverage ≥ 80%, and the note engine ≥ 95% (it is the riskiest code).
5. axe reports no serious or critical violations.
6. No high or critical dependency or secret-scan findings (NF-21).
7. E2E green on Chromium and WebKit (Firefox may be non-blocking during the beta).

Nightly: corpus in LLM mode, ZAP baseline, k6, Lighthouse. A failure opens an issue automatically.

## Test data

- **Clock and zone are always injected.** Tests never read the real clock. Every date test pins `now` and `timezone` (ADR-006).
- **Seed account:** example@gmail.com with SQL Course, Adv Web, HCI, Portfolio and Personal, matching the PRD.
- **LLM in CI:** a recorded-response stub for unit and API tests. The real provider is used only in the nightly corpus run.

## Definition of Done (per feature)

- Every acceptance criterion and edge case in the spec has a passing test with its ID.
- Every state in the state matrix has a component test.
- The feature's rows in the authorization matrix have passing SEC-12 cases.
- Copy matches the copy catalog. axe is clean. Keyboard path verified.
- Analytics events fire with the documented properties, and with no text.
