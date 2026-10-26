# Traceability Matrix

One row per requirement. Acceptance criteria live in each module's `prd.md`. The **Spec tests** column is generated from section 12 of each module spec. Regenerate it when a spec changes; CI fails if any requirement has no test ID ([test strategy](test-strategy.md#ci-gates-merge-blocked-if-any-fail), gate 3).

| ID | Priority | Module | Workflow | Test scenario | Spec tests |
|---|---|---|---|---|---|
| AA-1 | Must | M01-account-access | WF-07 |  | [spec](../03-modules/M01-account-access/spec.md#12-acceptance-criteria--tests): T-AA-01, T-AA-02, T-AA-108, T-AA-04, T-AA-05 |
| AA-2 | Must | M01-account-access | WF-07 |  | [spec](../03-modules/M01-account-access/spec.md#12-acceptance-criteria--tests): T-AA-10, SEC-08, T-AA-11, A11Y-60, T-AA-12, T-AA-13 |
| AA-3 | Must | M01-account-access | WF-07 | TS-12 | [spec](../03-modules/M01-account-access/spec.md#12-acceptance-criteria--tests): T-AA-20, T-AA-103, SEC-05 |
| AA-4 | Must | M01-account-access | WF-07 | TS-13 | [spec](../03-modules/M01-account-access/spec.md#12-acceptance-criteria--tests): T-AA-30, SEC-08, T-AA-31, SEC-09, T-AA-32 |
| AA-5 | Must | M01-account-access | WF-07 |  | [spec](../03-modules/M01-account-access/spec.md#12-acceptance-criteria--tests): T-AA-40, T-AA-41, SEC-50 |
| NC-1 | Must | M02-note-capture | WF-01 |  | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-01, T-NC-02, T-NC-03 |
| NC-2 | Must | M02-note-capture | WF-01 |  | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-04, T-NC-115 |
| NC-3 | Should | M02-note-capture | WF-01 |  | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-10, T-NC-11, T-NC-12 |
| NC-4 | Should | M02-note-capture | WF-01 | TS-17 | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-20, T-NC-21, T-NC-22, T-NC-23, T-NC-24, T-NC-25, T-RV-01 |
| NC-5 | Could | M02-note-capture | WF-01 |  | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-30 |
| NC-6 | Must | M02-note-capture | WF-05 | TS-08 | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-40, OFF-03, OFF-04, T-NC-41 |
| NC-7 | Must | M02-note-capture |  | TS-09 | [spec](../03-modules/M02-note-capture/spec.md#12-acceptance-criteria--tests): T-NC-50, T-NC-51, T-NC-52, T-NC-53 |
| NU-1 | Must | M03-note-understanding | WF-01 | TS-01 | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-01, T-NU-02, T-NU-03, T-NU-04, T-NU-05, T-NU-06, T-NU-120, T-NU-07 |
| NU-2 | Must | M03-note-understanding | WF-01 | TS-01 | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-10, T-NU-11, T-NU-12, T-NU-13, T-NU-14, T-NU-15, T-NU-16, T-NU-17 |
| NU-3 | Must | M03-note-understanding | WF-01, WF-05 | TS-02, TS-03 | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-20, C-016, T-NU-21, C-017, T-NU-22, C-018, T-NU-23, T-NU-24 |
| NU-4 | Must | M03-note-understanding | WF-03 | TS-06 | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-30, T-NU-31, T-NU-32, C-013–C-015, T-NU-33, C-013, C-014 |
| NU-5 | Must | M03-note-understanding | WF-02 | TS-04, TS-05 | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-40, C-018, T-NU-41, C-019, T-NU-42, T-NU-43, T-RV-40, T-RV-41 |
| NU-6 | Should | M03-note-understanding | WF-01, WF-03 | TS-01, TS-02 | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-50, T-NU-51 |
| NU-7 | Should | M03-note-understanding |  |  | [spec](../03-modules/M03-note-understanding/spec.md#12-acceptance-criteria--tests): T-NU-60, T-NU-61 |
| RV-1 | Must | M04-review-control | WF-01 | TS-01 | [spec](../03-modules/M04-review-control/spec.md#12-acceptance-criteria--tests): T-RV-01, T-RV-02, T-RV-03, T-RV-113 |
| RV-2 | Must | M04-review-control | WF-04 | TS-07 | [spec](../03-modules/M04-review-control/spec.md#12-acceptance-criteria--tests): T-RV-10, T-RV-11, T-RV-12, T-RV-13 |
| RV-3 | Must | M04-review-control | WF-03 | TS-06 | [spec](../03-modules/M04-review-control/spec.md#12-acceptance-criteria--tests): T-RV-20, T-RV-21, T-RV-22 |
| RV-4 | Must | M04-review-control | WF-01 |  | [spec](../03-modules/M04-review-control/spec.md#12-acceptance-criteria--tests): T-RV-30, T-RV-31, T-RV-32, T-RV-33 |
| TK-1 | Must | M05-tasks | WF-06 |  | [spec](../03-modules/M05-tasks/spec.md#12-acceptance-criteria--tests): T-TK-01, T-TK-02, T-TK-03 |
| TK-2 | Must | M05-tasks |  |  | [spec](../03-modules/M05-tasks/spec.md#12-acceptance-criteria--tests): T-TK-10, T-TK-11 |
| TK-3 | Must | M05-tasks |  | TS-10 | [spec](../03-modules/M05-tasks/spec.md#12-acceptance-criteria--tests): T-TK-20, T-TK-21, T-TK-22 |
| TK-4 | Must | M05-tasks | WF-06 | TS-11 | [spec](../03-modules/M05-tasks/spec.md#12-acceptance-criteria--tests): T-TK-30, T-TK-101–103, T-TK-115, T-TK-31, T-TK-105 |
| TK-5 | Must | M05-tasks |  |  | [spec](../03-modules/M05-tasks/spec.md#12-acceptance-criteria--tests): T-TK-40, T-TK-41 |
| TK-6 | Should | M05-tasks |  |  | [spec](../03-modules/M05-tasks/spec.md#12-acceptance-criteria--tests): T-TK-50, T-TK-51, T-TK-52 |
| LV-1 | Must | M06-lists-search | WF-06 | TS-14 | [spec](../03-modules/M06-lists-search/spec.md#12-acceptance-criteria--tests): T-LV-01, T-LV-02, T-LV-03, T-LV-04, T-LV-111 |
| LV-2 | Must | M06-lists-search |  |  | [spec](../03-modules/M06-lists-search/spec.md#12-acceptance-criteria--tests): T-LV-10, T-LV-11, T-LV-112 |
| LV-3 | Must | M06-lists-search |  | TS-15 | [spec](../03-modules/M06-lists-search/spec.md#12-acceptance-criteria--tests): T-LV-20, T-LV-105–107, T-LV-21, T-LV-22 |
| LV-4 | Must | M06-lists-search |  |  | [spec](../03-modules/M06-lists-search/spec.md#12-acceptance-criteria--tests): T-LV-30, A11Y-51 |
| PJ-1 | Must | M07-projects |  |  | [spec](../03-modules/M07-projects/spec.md#12-acceptance-criteria--tests): T-PJ-01, T-PJ-101, T-PJ-02, T-PJ-03 |
| PJ-2 | Must | M07-projects |  |  | [spec](../03-modules/M07-projects/spec.md#12-acceptance-criteria--tests): T-PJ-10, T-PJ-11 |
| PJ-3 | Should | M07-projects |  |  | [spec](../03-modules/M07-projects/spec.md#12-acceptance-criteria--tests): T-PJ-20, T-PJ-21 |
| PJ-4 | Must | M07-projects |  | TS-16 | [spec](../03-modules/M07-projects/spec.md#12-acceptance-criteria--tests): T-PJ-30, T-PJ-31, SEC-18 |
| AP-1 | Must | M08-app-platform | WF-07 |  | [spec](../03-modules/M08-app-platform/spec.md#12-acceptance-criteria--tests): T-AP-01, T-AP-101, T-AP-02, T-AP-03 |
| AP-2 | Must | M08-app-platform | WF-05 | TS-08 | [spec](../03-modules/M08-app-platform/spec.md#12-acceptance-criteria--tests): OFF-01–04, OFF-10–15, OFF-20–21, PERF-04, T-AP-10, T-AP-104 |
| AP-3 | Must | M08-app-platform |  |  | [spec](../03-modules/M08-app-platform/spec.md#12-acceptance-criteria--tests): T-AP-20, T-AP-21, T-AP-22 |
| AP-4 | Must | M08-app-platform |  |  | [spec](../03-modules/M08-app-platform/spec.md#12-acceptance-criteria--tests): T-AP-30, T-AP-106 |

## Non-functional

| ID | Area | File | Verified by |
|---|---|---|---|
| NF-1 | Accessibility | [usability.md](../05-non-functional-requirements/usability.md) | axe in both themes (every screen and state), A11Y-71 |
| NF-2 | Accessibility | [usability.md](../05-non-functional-requirements/usability.md) | A11Y-10–82, keyboard-only E2E paths, axe |
| NF-3 | Accessibility | [usability.md](../05-non-functional-requirements/usability.md) | A11Y-10, A11Y-23, A11Y-31, A11Y-61, manual VoiceOver/TalkBack pass |
| NF-4 | Performance | [performance.md](../05-non-functional-requirements/performance.md) | Lighthouse CI ([M08 §10](../03-modules/M08-app-platform/spec.md#10-performance-and-scaling)) |
| NF-5 | Performance | [performance.md](../05-non-functional-requirements/performance.md) | PERF-02, [M03 §10](../03-modules/M03-note-understanding/spec.md#10-performance-and-scaling) budget |
| NF-6 | Offline | [reliability.md](../05-non-functional-requirements/reliability.md) | TS-08, OFF-01–04, OFF-10–15, OFF-20–21, OFF-30–31, PERF-04 |
| NF-7 | Platform | [deployment.md](../05-non-functional-requirements/deployment.md) | T-AP-01, T-AP-101, E2E browser matrix ([test strategy](test-strategy.md#levels-and-tools)) |
| NF-8 | Layout | [usability.md](../05-non-functional-requirements/usability.md) | E2E viewports 320, 360, 480 and 600 wide, no horizontal scroll (UX-23) |
| NF-9 | Privacy | [security.md](../05-non-functional-requirements/security.md) | TS-18, SEC-34, SEC-43, SEC-44, SEC-61 |
| NF-10 | Security | [security.md](../05-non-functional-requirements/security.md) | SEC-03, SEC-05, SEC-09, SEC-20 |
| NF-11 | Reliability | [reliability.md](../05-non-functional-requirements/reliability.md) | TS-07, T-NU-73, T-RV-13 |
| NF-12 | Content | [usability.md](../05-non-functional-requirements/usability.md) | Copy-catalog lint (no inline strings), UX-32 date-format unit tests |
| NF-13 | Rate limits | [security.md](../05-non-functional-requirements/security.md#rate-limits-nf-13) | SEC-10 |
| NF-14 | Input limits | [security.md](../05-non-functional-requirements/security.md#input-limits-nf-14) | SEC-11, T-NU-114, T-PJ-102 |
| NF-15 | Session | [ADR-007](../07-architecture/technical-decisions/ADR-007-session-and-auth.md) | SEC-01–04 |
| NF-16 | Security headers | [security.md](../05-non-functional-requirements/security.md) | SEC-20 |
| NF-17 | File upload | [security.md](../05-non-functional-requirements/security.md) | SEC-30–35, T-NC-105–109 |
| NF-18 | LLM controls | [ADR-008](../07-architecture/technical-decisions/ADR-008-llm-fallback.md) | SEC-40–44, T-NU-127 |
| NF-19 | Client data | [security.md](../05-non-functional-requirements/security.md) | SEC-50–52 |
| NF-20 | Audit log | [security.md](../05-non-functional-requirements/security.md) | SEC-60 |
| NF-21 | Supply chain | [security.md](../05-non-functional-requirements/security.md) | SEC-70 |
