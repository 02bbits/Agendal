# Acceptance

How Agendal's requirements are verified.

| Document | Purpose |
|---|---|
| [traceability-matrix.md](traceability-matrix.md) | Every requirement → module → workflow → test scenario |
| [test-scenarios.md](test-scenarios.md) | Given/When/Then scenarios (`TS-nn`) for the riskiest flows, each linked to its automated tests |
| [test-strategy.md](test-strategy.md) | Test levels, tools, CI gates, test IDs, Definition of Done |
| [note-corpus/](note-corpus/) | Golden notes with expected plans, run in rules and LLM modes |
| [asvs-checklist.md](asvs-checklist.md) | OWASP ASVS L2 requirements with how each is met and tested |

Every functional requirement carries its own **acceptance criteria** in its module's `prd.md`. Those criteria are the test oracle, and the scenarios here add worked end-to-end cases.

## Release gates (from the [release plan](../01-product/product-scope.md))

| Phase | Gate |
|---|---|
| MVP | All Must acceptance criteria pass. Accessibility audit passes NF-1–NF-3. Note acceptance ≥ 85% in a closed beta |
| v1.1 | Metrics at or near target for 4 weeks |

## Non-functional verification

| Area | Method |
|---|---|
| Accessibility (NF-1–3) | Contrast check in both themes. Keyboard-only and VoiceOver/TalkBack pass on every screen. Reduced-motion check |
| Performance (NF-4, NF-5) | Lighthouse on a mid-range phone profile over 4G. Note processing p90 measured from `note_processed.ms` |
| Offline (NF-6) | Airplane-mode script: edit, capture, reconnect, then verify no loss and per-field LWW |
| Platform (NF-7) | PWA installability check. Smoke test on the browser matrix |
| Note understanding | The [golden note corpus](note-corpus/) with accuracy gates, in CI on every push (rules) and nightly (LLM) |
