# Traceability Matrix

One row per requirement: where it is specified, which workflows and scenarios exercise it, and its tests. The test column is generated from section 11 of each [module](../03-modules/); regenerate it when a module changes. CI fails if any requirement has no test ID ([test strategy](test-strategy.md#ci-gates-merge-blocked-if-any-fail), gate 3).

## Functional

| ID | Priority | Module | Workflows | Test scenarios | Tests |
|---|---|---|---|---|---|
| [AA-1](../03-modules/AA-account-access.md#aa-1) | Must | [AA](../03-modules/AA-account-access.md#requirements) | [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md) |  | [§11](../03-modules/AA-account-access.md#11-acceptance-criteria--tests): T-AA-01, T-AA-02, T-AA-108, T-AA-04, T-AA-05 |
| [AA-2](../03-modules/AA-account-access.md#aa-2) | Must | [AA](../03-modules/AA-account-access.md#requirements) | [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md) |  | [§11](../03-modules/AA-account-access.md#11-acceptance-criteria--tests): T-AA-10, SEC-08, T-AA-11, A11Y-60, T-AA-12, T-AA-13 |
| [AA-3](../03-modules/AA-account-access.md#aa-3) | Must | [AA](../03-modules/AA-account-access.md#requirements) | [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md) | [TS-12](test-scenarios.md#ts-12) | [§11](../03-modules/AA-account-access.md#11-acceptance-criteria--tests): T-AA-20, T-AA-103, SEC-05 |
| [AA-4](../03-modules/AA-account-access.md#aa-4) | Must | [AA](../03-modules/AA-account-access.md#requirements) | [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md) | [TS-13](test-scenarios.md#ts-13) | [§11](../03-modules/AA-account-access.md#11-acceptance-criteria--tests): T-AA-30, SEC-08, T-AA-31, SEC-09, T-AA-32 |
| [AA-5](../03-modules/AA-account-access.md#aa-5) | Must | [AA](../03-modules/AA-account-access.md#requirements) | [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md) |  | [§11](../03-modules/AA-account-access.md#11-acceptance-criteria--tests): T-AA-40, T-AA-41, SEC-50 |
| [NC-1](../03-modules/NC-note-capture.md#nc-1) | Must | [NC](../03-modules/NC-note-capture.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) |  | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-01, T-NC-02, T-NC-03 |
| [NC-2](../03-modules/NC-note-capture.md#nc-2) | Must | [NC](../03-modules/NC-note-capture.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) |  | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-04, T-NC-115 |
| [NC-3](../03-modules/NC-note-capture.md#nc-3) | Should | [NC](../03-modules/NC-note-capture.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) |  | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-10, T-NC-11, T-NC-12 |
| [NC-4](../03-modules/NC-note-capture.md#nc-4) | Should | [NC](../03-modules/NC-note-capture.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) | [TS-17](test-scenarios.md#ts-17) | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-20, T-NC-21, T-NC-22, T-NC-23, T-NC-24, T-NC-25, T-RV-01 |
| [NC-5](../03-modules/NC-note-capture.md#nc-5) | Could | [NC](../03-modules/NC-note-capture.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) |  | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-30 |
| [NC-6](../03-modules/NC-note-capture.md#nc-6) | Must | [NC](../03-modules/NC-note-capture.md#requirements) | [WF-05](../04-workflows/WF-05-offline-capture-and-sync.md) | [TS-08](test-scenarios.md#ts-08) | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-40, OFF-03, OFF-04, T-NC-41 |
| [NC-7](../03-modules/NC-note-capture.md#nc-7) | Must | [NC](../03-modules/NC-note-capture.md#requirements) |  | [TS-09](test-scenarios.md#ts-09) | [§11](../03-modules/NC-note-capture.md#11-acceptance-criteria--tests): T-NC-50, T-NC-51, T-NC-52, T-NC-53 |
| [NU-1](../03-modules/NU-note-understanding.md#nu-1) | Must | [NU](../03-modules/NU-note-understanding.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) | [TS-01](test-scenarios.md#ts-01) | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-01, T-NU-02, T-NU-03, T-NU-04, T-NU-05, T-NU-06, T-NU-120, T-NU-07 |
| [NU-2](../03-modules/NU-note-understanding.md#nu-2) | Must | [NU](../03-modules/NU-note-understanding.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) | [TS-01](test-scenarios.md#ts-01) | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-10, T-NU-11, T-NU-12, T-NU-13, T-NU-14, T-NU-15, T-NU-16, T-NU-17, T-NU-18, C-044, C-045, C-051 |
| [NU-3](../03-modules/NU-note-understanding.md#nu-3) | Must | [NU](../03-modules/NU-note-understanding.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md), [WF-05](../04-workflows/WF-05-offline-capture-and-sync.md), [WF-06](../04-workflows/WF-06-complete-a-task.md) | [TS-02](test-scenarios.md#ts-02), [TS-03](test-scenarios.md#ts-03) | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-20, C-016, T-NU-21, C-017, T-NU-22, C-018, T-NU-23, T-NU-24, T-NU-25, C-046, C-047, C-048 |
| [NU-4](../03-modules/NU-note-understanding.md#nu-4) | Must | [NU](../03-modules/NU-note-understanding.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md), [WF-03](../04-workflows/WF-03-resolve-unclear-note.md) | [TS-06](test-scenarios.md#ts-06) | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-30, T-NU-31, T-NU-32, C-013–C-015, T-NU-33, C-013, C-014 |
| [NU-5](../03-modules/NU-note-understanding.md#nu-5) | Must | [NU](../03-modules/NU-note-understanding.md#requirements) | [WF-02](../04-workflows/WF-02-confirm-risky-changes.md) | [TS-04](test-scenarios.md#ts-04), [TS-05](test-scenarios.md#ts-05) | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-40, C-018, T-NU-41, C-019, T-NU-42, T-NU-43 |
| [NU-6](../03-modules/NU-note-understanding.md#nu-6) | Should | [NU](../03-modules/NU-note-understanding.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md), [WF-03](../04-workflows/WF-03-resolve-unclear-note.md) | [TS-01](test-scenarios.md#ts-01) | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-50, T-NU-51 |
| [NU-7](../03-modules/NU-note-understanding.md#nu-7) | Should | [NU](../03-modules/NU-note-understanding.md#requirements) |  |  | [§11](../03-modules/NU-note-understanding.md#11-acceptance-criteria--tests): T-NU-60, T-NU-61 |
| [RV-1](../03-modules/RV-review-control.md#rv-1) | Must | [RV](../03-modules/RV-review-control.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) | [TS-01](test-scenarios.md#ts-01) | [§11](../03-modules/RV-review-control.md#11-acceptance-criteria--tests): T-RV-01, T-RV-02, T-RV-03, T-RV-113, T-RV-04, T-RV-05 |
| [RV-2](../03-modules/RV-review-control.md#rv-2) | Must | [RV](../03-modules/RV-review-control.md#requirements) | [WF-04](../04-workflows/WF-04-undo-a-note.md) | [TS-07](test-scenarios.md#ts-07) | [§11](../03-modules/RV-review-control.md#11-acceptance-criteria--tests): T-RV-10, T-RV-11, T-RV-12, T-RV-13 |
| [RV-3](../03-modules/RV-review-control.md#rv-3) | Must | [RV](../03-modules/RV-review-control.md#requirements) | [WF-03](../04-workflows/WF-03-resolve-unclear-note.md) | [TS-06](test-scenarios.md#ts-06) | [§11](../03-modules/RV-review-control.md#11-acceptance-criteria--tests): T-RV-20, T-RV-21, T-RV-22 |
| [RV-4](../03-modules/RV-review-control.md#rv-4) | Must | [RV](../03-modules/RV-review-control.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) |  | [§11](../03-modules/RV-review-control.md#11-acceptance-criteria--tests): T-RV-30, T-RV-31, T-RV-32, T-RV-33 |
| [RV-5](../03-modules/RV-review-control.md#rv-5) | Must | [RV](../03-modules/RV-review-control.md#requirements) |  |  | [§11](../03-modules/RV-review-control.md#11-acceptance-criteria--tests): T-RV-60, T-RV-61, T-RV-62, T-RV-63, T-RV-64 |
| [TK-1](../03-modules/TK-tasks.md#tk-1) | Must | [TK](../03-modules/TK-tasks.md#requirements) | [WF-06](../04-workflows/WF-06-complete-a-task.md) |  | [§11](../03-modules/TK-tasks.md#11-acceptance-criteria--tests): T-TK-01, T-TK-02, T-TK-03 |
| [TK-2](../03-modules/TK-tasks.md#tk-2) | Must | [TK](../03-modules/TK-tasks.md#requirements) | [WF-01](../04-workflows/WF-01-capture-and-process-note.md) |  | [§11](../03-modules/TK-tasks.md#11-acceptance-criteria--tests): T-TK-10, T-TK-11 |
| [TK-3](../03-modules/TK-tasks.md#tk-3) | Must | [TK](../03-modules/TK-tasks.md#requirements) |  | [TS-10](test-scenarios.md#ts-10) | [§11](../03-modules/TK-tasks.md#11-acceptance-criteria--tests): T-TK-20, T-TK-21, T-TK-22 |
| [TK-4](../03-modules/TK-tasks.md#tk-4) | Must | [TK](../03-modules/TK-tasks.md#requirements) | [WF-06](../04-workflows/WF-06-complete-a-task.md) | [TS-11](test-scenarios.md#ts-11) | [§11](../03-modules/TK-tasks.md#11-acceptance-criteria--tests): T-TK-30, T-TK-101–103, T-TK-115, T-TK-31, T-TK-105 |
| [TK-5](../03-modules/TK-tasks.md#tk-5) | Must | [TK](../03-modules/TK-tasks.md#requirements) |  |  | [§11](../03-modules/TK-tasks.md#11-acceptance-criteria--tests): T-TK-40, T-TK-41 |
| [TK-6](../03-modules/TK-tasks.md#tk-6) | Should | [TK](../03-modules/TK-tasks.md#requirements) |  |  | [§11](../03-modules/TK-tasks.md#11-acceptance-criteria--tests): T-TK-50, T-TK-51, T-TK-52 |
| [LV-1](../03-modules/LV-lists-search.md#lv-1) | Must | [LV](../03-modules/LV-lists-search.md#requirements) | [WF-06](../04-workflows/WF-06-complete-a-task.md) | [TS-14](test-scenarios.md#ts-14) | [§11](../03-modules/LV-lists-search.md#11-acceptance-criteria--tests): T-LV-01, T-LV-02, T-LV-03, T-LV-04, T-LV-111 |
| [LV-2](../03-modules/LV-lists-search.md#lv-2) | Must | [LV](../03-modules/LV-lists-search.md#requirements) |  |  | [§11](../03-modules/LV-lists-search.md#11-acceptance-criteria--tests): T-LV-10, T-LV-11, T-LV-112 |
| [LV-3](../03-modules/LV-lists-search.md#lv-3) | Must | [LV](../03-modules/LV-lists-search.md#requirements) |  | [TS-15](test-scenarios.md#ts-15) | [§11](../03-modules/LV-lists-search.md#11-acceptance-criteria--tests): T-LV-20, T-LV-105–107, T-LV-21, T-LV-22 |
| [LV-4](../03-modules/LV-lists-search.md#lv-4) | Must | [LV](../03-modules/LV-lists-search.md#requirements) |  |  | [§11](../03-modules/LV-lists-search.md#11-acceptance-criteria--tests): T-LV-30, A11Y-51 |
| [PJ-1](../03-modules/PJ-projects.md#pj-1) | Must | [PJ](../03-modules/PJ-projects.md#requirements) |  |  | [§11](../03-modules/PJ-projects.md#11-acceptance-criteria--tests): T-PJ-01, T-PJ-101, T-PJ-02, T-PJ-03 |
| [PJ-2](../03-modules/PJ-projects.md#pj-2) | Must | [PJ](../03-modules/PJ-projects.md#requirements) |  |  | [§11](../03-modules/PJ-projects.md#11-acceptance-criteria--tests): T-PJ-10, T-PJ-11 |
| [PJ-3](../03-modules/PJ-projects.md#pj-3) | Should | [PJ](../03-modules/PJ-projects.md#requirements) |  |  | [§11](../03-modules/PJ-projects.md#11-acceptance-criteria--tests): T-PJ-20, T-PJ-21 |
| [PJ-4](../03-modules/PJ-projects.md#pj-4) | Must | [PJ](../03-modules/PJ-projects.md#requirements) |  | [TS-16](test-scenarios.md#ts-16) | [§11](../03-modules/PJ-projects.md#11-acceptance-criteria--tests): T-PJ-30, T-PJ-31, SEC-18 |
| [AP-1](../03-modules/AP-app-platform.md#ap-1) | Must | [AP](../03-modules/AP-app-platform.md#requirements) | [WF-07](../04-workflows/WF-07-sign-in-and-recovery.md) |  | [§11](../03-modules/AP-app-platform.md#11-acceptance-criteria--tests): T-AP-01, T-AP-101, T-AP-02, T-AP-03 |
| [AP-2](../03-modules/AP-app-platform.md#ap-2) | Must | [AP](../03-modules/AP-app-platform.md#requirements) | [WF-05](../04-workflows/WF-05-offline-capture-and-sync.md) | [TS-08](test-scenarios.md#ts-08) | [§11](../03-modules/AP-app-platform.md#11-acceptance-criteria--tests): OFF-01–04, OFF-10–15, OFF-20–21, PERF-04, T-AP-10, T-AP-104 |
| [AP-3](../03-modules/AP-app-platform.md#ap-3) | Must | [AP](../03-modules/AP-app-platform.md#requirements) |  |  | [§11](../03-modules/AP-app-platform.md#11-acceptance-criteria--tests): T-AP-20, T-AP-21, T-AP-22 |
| [AP-4](../03-modules/AP-app-platform.md#ap-4) | Must | [AP](../03-modules/AP-app-platform.md#requirements) |  |  | [§11](../03-modules/AP-app-platform.md#11-acceptance-criteria--tests): T-AP-30, T-AP-106, [RV-E12](../03-modules/RV-review-control.md#rv-e12) |
| [AP-5](../03-modules/AP-app-platform.md#ap-5) | Must | [AP](../03-modules/AP-app-platform.md#requirements) |  |  | [§11](../03-modules/AP-app-platform.md#11-acceptance-criteria--tests): T-AP-50, T-AP-51, T-AP-52, T-NU-110 |

## Non-functional

| ID | Area | Verified by |
|---|---|---|
| [NF-1](../05-quality/nfr.md#nf-1) | Accessibility | axe in both themes (every screen and state), A11Y-71 |
| [NF-2](../05-quality/nfr.md#nf-2) | Accessibility | A11Y-10–82, keyboard-only E2E paths, axe |
| [NF-3](../05-quality/nfr.md#nf-3) | Accessibility | A11Y-10, A11Y-23, A11Y-31, A11Y-61, manual VoiceOver/TalkBack pass |
| [NF-4](../05-quality/nfr.md#nf-4) | Performance | Lighthouse CI ([AP §10](../03-modules/AP-app-platform.md#10-performance-and-scaling)) |
| [NF-5](../05-quality/nfr.md#nf-5) | Performance | PERF-02, [NU §10](../03-modules/NU-note-understanding.md#10-performance-and-scaling) budget |
| [NF-6](../05-quality/nfr.md#nf-6) | Offline | [TS-08](test-scenarios.md#ts-08), OFF-01–04, OFF-10–15, OFF-20–21, OFF-30–31, PERF-04 |
| [NF-7](../05-quality/nfr.md#nf-7) | Platform | T-AP-01, T-AP-101, E2E browser matrix ([test strategy](test-strategy.md#levels-and-tools)) |
| [NF-8](../05-quality/nfr.md#nf-8) | Layout | E2E viewports 320, 360, 480 and 600 wide, no horizontal scroll ([UX-23](../01-product/ux-standards.md#ux-23)). At 768 and 1280 wide, one centred 600px column with the bars and sheets inside it ([UX-24](../01-product/ux-standards.md#ux-24)). Sideways at 667×375, bars visible and nothing covered ([UX-26](../01-product/ux-standards.md#ux-26)) |
| [NF-9](../05-quality/nfr.md#nf-9) | Privacy | [TS-18](test-scenarios.md#ts-18), SEC-34, SEC-43, SEC-44, SEC-61 |
| [NF-10](../05-quality/nfr.md#nf-10) | Security | SEC-03, SEC-05, SEC-09, SEC-20 |
| [NF-11](../05-quality/nfr.md#nf-11) | Reliability | [TS-07](test-scenarios.md#ts-07), T-NU-73, T-RV-13 |
| [NF-12](../05-quality/nfr.md#nf-12) | Content | Copy-catalog lint (no inline strings), [UX-32](../01-product/ux-standards.md#ux-32) date-format unit tests |
| [NF-13](../05-quality/nfr.md#nf-13) | Rate limits | SEC-10 |
| [NF-14](../05-quality/nfr.md#nf-14) | Input limits | SEC-11, T-NU-114, T-PJ-102 |
| [NF-15](../05-quality/nfr.md#nf-15) | Session | SEC-01–04 |
| [NF-16](../05-quality/nfr.md#nf-16) | Security headers | SEC-20 |
| [NF-17](../05-quality/nfr.md#nf-17) | File upload | SEC-30–35, T-NC-105–109 |
| [NF-18](../05-quality/nfr.md#nf-18) | LLM controls | SEC-40–44, T-NU-127 |
| [NF-19](../05-quality/nfr.md#nf-19) | Client data | SEC-50–52 |
| [NF-20](../05-quality/nfr.md#nf-20) | Audit log | SEC-60 |
| [NF-21](../05-quality/nfr.md#nf-21) | Supply chain | SEC-70 |
