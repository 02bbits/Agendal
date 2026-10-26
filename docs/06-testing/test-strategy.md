# Test Strategy

**Goal:** every acceptance criterion, edge case and security control has an automated test, and CI blocks a merge that breaks any of them.

## Test IDs

| Prefix | What | Defined in |
|---|---|---|
| `T-<AREA>-nn` (e.g. `T-NU-07`) | Functional and edge-case tests | Each [module](../03-modules/)'s section 11 |
| `SEC-nn` | Security controls | [threat model](../07-architecture/security.md), [security NFRs](../05-quality/nfr.md#security-and-privacy) |
| `PERF-nn` | Load and latency | [scalability](../05-quality/scalability.md#load-test-plan) |
| `A11Y-nn` | Accessibility | Each module's section 6 |
| `OFF-nn` | Offline and sync end-to-end | The NC and AP modules, [ADR-004](../07-architecture/decisions/ADR-004-offline-sync-field-level-lww.md)/005 |
| `C-nnn` | Golden note-corpus cases | [note-corpus/](note-corpus/) |

Write the test ID in the test name (`it('T-NU-07 tonight after 20:00 has no time')`), so the traceability matrix can be checked by a script.

## Levels and tools

| Level | Scope | Tools | Runs |
|---|---|---|---|
| Unit | Note engine (split, extract, match, name, safety), date math, validators, reducers | Pest (PHP engine), Vitest (client helpers) | Every push |
| Corpus | Whole-note plans against the golden set, in rules mode and rules + LLM mode (LLM mode: nightly and on prompt/model change, against the real provider) | Pest data provider over `note-corpus/*.yaml` | Every push (rules), nightly (LLM) |
| API / integration | Endpoints with a real DB: validation, authorization matrix, rate limits, idempotency, undo, sync | Pest + Laravel HTTP tests, a fresh DB per test | Every push |
| Component | Screens and components in every state of the module's state matrix | Vitest + React Testing Library | Every push |
| End-to-end | Workflows [WF-01](../04-workflows/WF-01-capture-and-process-note.md)–07 in a real browser, including offline (`context.setOffline`) and two-device sync | Playwright (Chromium, WebKit, Firefox; mobile viewport 360×800) | Every PR |
| Accessibility | axe on every screen and state, keyboard-only paths | @axe-core/playwright. Manual VoiceOver/TalkBack pass before each release | Every PR (axe), release (manual) |
| Security | Authorization matrix, CSRF, headers, upload abuse, rate limits | Pest + Playwright, OWASP ZAP baseline against the server, `composer audit`, `npm audit`, secret scan | Every PR. ZAP nightly |
| Performance | PERF-01–05 | k6 against the server. Lighthouse CI for [NF-4](../05-quality/nfr.md#nf-4) | Before the demo |

## CI gates (merge blocked if any fail)

1. Lint, format, and type-check (PHP and TypeScript strict).
2. Unit, corpus (rules mode), API and component tests are 100% green.
3. Every acceptance criterion in every module's Requirements table maps to at least one test ID that exists in the test suite (traceability script).
4. Backend line coverage ≥ 80%, and the note engine ≥ 95% (it is the riskiest code).
5. axe reports no serious or critical violations.
6. No high or critical dependency or secret-scan findings ([NF-21](../05-quality/nfr.md#nf-21)).
7. E2E green on Chromium and WebKit (Firefox may be non-blocking).

Nightly: corpus in LLM mode, ZAP baseline, k6, Lighthouse. A failure opens an issue automatically.

## Test data

- **Clock and zone are always injected.** Tests never read the real clock. Every date test pins `now` and `timezone` ([ADR-006](../07-architecture/decisions/ADR-006-time-zones.md)).
- **Seed account:** example@gmail.com with SQL Course, Adv Web, HCI, Portfolio and Personal, matching the PRD.
- **LLM in CI:** a recorded-response stub for unit and API tests. The real provider is used only in the nightly corpus run.

## Definition of Done (per feature)

- Every acceptance criterion and edge case in the module has a passing test with its ID.
- Every state in the state matrix has a component test.
- The feature's rows in the authorization matrix have passing SEC-12 cases.
- Copy matches the copy catalog. axe is clean. Keyboard path verified.

## Release gates

From the [release plan](../01-product/overview.md#release-plan).

| Phase | Gate |
|---|---|
| MVP | All Must acceptance criteria pass. Accessibility audit passes [NF-1](../05-quality/nfr.md#nf-1)–[NF-3](../05-quality/nfr.md#nf-3). The note corpus passes every accuracy gate in both modes |
| v1.1 | All Should acceptance criteria pass |

## Non-functional verification

| Area | Method |
|---|---|
| Accessibility ([NF-1](../05-quality/nfr.md#nf-1)–3) | Contrast check in both themes. Keyboard-only and VoiceOver/TalkBack pass on every screen. Reduced-motion check |
| Performance ([NF-4](../05-quality/nfr.md#nf-4), [NF-5](../05-quality/nfr.md#nf-5)) | Lighthouse on a mid-range phone profile over 4G. Note processing p90 from the server's processing log |
| Offline ([NF-6](../05-quality/nfr.md#nf-6)) | Airplane-mode script: edit, capture, reconnect, then verify no loss and per-field LWW |
| Platform ([NF-7](../05-quality/nfr.md#nf-7)) | PWA installability check. Smoke test on the browser matrix |
| Note understanding | The [golden note corpus](note-corpus/) with accuracy gates, in CI on every push (rules) and nightly (LLM) |
