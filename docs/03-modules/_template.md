# XX — Module name

<!-- Copy this file to 03-modules/XX-module-name.md, where XX is the module's requirement prefix (AA, NC, …).
     Every section is a Definition of Ready item: a feature is ready to build when every section is filled
     or marked "None" with a reason. Keep the section numbers: other docs link to anchors such as
     #4-edge-cases and #7-api-contract. Edge cases are numbered XX-E1, XX-E2, …; tests T-XX-nn. -->

One sentence: what this module does for the user.

**Status:** Draft | In review | Ready · **Depends on:** ADR-…, business rules …

- **Screens:** … ([screens](../01-product/screens.md))
- **Workflows:** WF-…

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| XX-1 | … | Must | … |

## 1. Entry points and user stories

Where the user starts each feature, and what they're trying to get done. One line per story: "As a user, I …, so that …".

## 2. Behaviour detail

The rules the PRD leaves open: defaults, limits (link [NF-14](../05-quality/nfr.md#nf-14) rather than restating it), sort orders, and how ties are broken. Shared interaction rules are in [UX standards](../01-product/ux-standards.md). Reference them by ID (UX-nn).

## 3. State matrix

One row per screen or component. Columns: empty, loading, success, partial, error, offline, permission denied. Each cell says what shows and which copy key is used. "—" means the state can't happen.

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| XX-E1 | … | … | T-XX-101 |

Every row gets a decision (never "TBD", which belongs in [open questions](../08-project/open-questions.md)) and a test ID.

## 5. Copy keys

The [copy catalog](../01-product/copy-catalog.md) keys this module uses. New strings go into the catalog first.

## 6. Accessibility

Focus order, focus after each action, live-region announcements, and accessible names for icon buttons. A11Y test IDs.

## 7. API contract

For each endpoint: request schema, response schema, status codes and error codes, rate limit, and idempotency.

## 8. Data, validation and authorization

Tables and columns touched, transaction boundaries, server-side validation, and the [authorization matrix](../07-architecture/security.md#authorization-matrix) rows this module owns.

## 9. Abuse cases

How the feature could be misused. Link each one to a control (SC-nn) and its test (SEC-nn) in the [threat model](../07-architecture/security.md).

## 10. Performance and scaling

Latency budget, the queries and the indexes they rely on, background work, and the load test that covers it ([scalability](../05-quality/scalability.md)).

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|

Every acceptance criterion in the Requirements table has at least one row. Test IDs follow the [test strategy](../06-testing/test-strategy.md#test-ids).
