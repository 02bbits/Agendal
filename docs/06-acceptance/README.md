# Acceptance

How Agendal's requirements are verified.

| Document | Purpose |
|---|---|
| [traceability-matrix.md](traceability-matrix.md) | Every FR → module → workflow → test scenario |
| [test-scenarios.md](test-scenarios.md) | Given/When/Then acceptance scenarios (`TS-nn`) |

## Definition of done for a requirement

1. Implemented and covered by automated tests (NFR-25: backend ≥ 70% coverage, assistant actions tested against a mocked AI provider).
2. Its acceptance scenario passes.
3. The traceability matrix row is complete.

## Non-functional verification

| Area | Method |
|---|---|
| Performance / PWA | Lighthouse mobile (Performance ≥ 80, PWA installable), LCP p75 ≤ 3 s (NFR-1, NFR-3, NFR-20) |
| Assistant accuracy | ≥ 100-message test set, run before every prompt or model change (NFR-15) |
| Accessibility | WCAG 2.1 AA audit (NFR-18) |
| Security | Authorization tests for 403/404 on every resource (NFR-11), rate-limit tests (NFR-10) |
