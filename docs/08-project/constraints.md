# Constraints

| Type | Constraint | Source |
|---|---|---|
| Product | Mobile web app (PWA), phones 320–480px, no native apps | PRD, NF-7, NF-8 |
| Design | Paper & ink theme, Agendal design system, WCAG 2.2 AA | [theme guide](../01-product/theme-guide.md), NF-1–3 |
| Content | Sentence case, 24-hour times, short dates, no emoji | NF-12 |
| Privacy | No note or task text in analytics. Files discarded after extraction | NF-9 |
| Academic | Course project for VNUK *Advanced Web Development*. The course sets the schedule and team size | — |

## Engineering conventions (carried over from V1, to confirm)

The PRD doesn't set these. They are the team's working defaults from the V1 docs.

| Area | Convention |
|---|---|
| Frontend | Next.js, React, TypeScript strict, ESLint and Prettier. Components from the Agendal design system |
| Backend | Laravel, policies for authorization, business logic in services/actions, PSR-12 (Pint) |
| Tests | Backend coverage ≥ 70%. Note understanding tested against a fixed sample-note set |
| CI | Lint, type-check and tests on every pull request (GitHub Actions) |
| API | Versioned `/api/v1`, with generated documentation |
