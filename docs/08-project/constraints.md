# Constraints

| Type | Constraint | Source |
|---|---|---|
| Technology | Frontend: Next.js, React, TypeScript (strict), Tailwind, shadcn/ui | NFR-3, NFR-19, NFR-25 |
| Technology | Backend: Laravel, Sanctum, Policies, queues, PHPUnit/Pest, Pint (PSR-12) | NFR-5–11, NFR-25 |
| Technology | API docs generated with Scramble. Versioned `/api/v1` | NFR-26 |
| Technology | Must be a PWA (manifest + service worker), with no app-store distribution | FR-65, NFR-20 |
| Quality | Backend test coverage ≥ 70%. CI on every PR via GitHub Actions | NFR-25 |
| Quality | WCAG 2.1 AA. 44 × 44 px touch targets | NFR-18 |
| Privacy | Minimal data to the AI provider. No retention or training. Voice deleted after transcription | NFR-12 |
| Security | AI and speech keys never reach the browser or the repo | NFR-12 |
| Academic | Course project for VNUK *Advanced Web Development*. Schedule and team size set by the course | — |
