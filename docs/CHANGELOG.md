# Docs changelog

What changed in the docs, newest first. Each entry names the files and IDs touched; the full text is in git history.

## 2026-11-01

- **Three inconsistencies settled (#102).** (1) A note with nothing actionable gets the follow-up (Keep as note or Make it a task) everywhere: [BR-02](02-domain/business-rules.md#br-02), the note-naming table (a kept note is named from its first 6 words) and the [RV-3](03-modules/RV-review-control.md#rv-3) acceptance text now match [RV §2.3](03-modules/RV-review-control.md#23-follow-up-rv-3) and [WF-03](04-workflows/WF-03-resolve-unclear-note.md). (2) "Check this first" now starts at **5 or more** changes in one note, not more than 5 (a task counts once however many fields change): [BR-01](02-domain/business-rules.md#br-01) is rewritten, and [NU-5](03-modules/NU-note-understanding.md#nu-5), NU §2.6, [WF-01](04-workflows/WF-01-capture-and-process-note.md), [WF-02](04-workflows/WF-02-confirm-risky-changes.md), the [domain](02-domain/domain.md) diagrams, the [overview](01-product/overview.md), [TS-05](06-testing/test-scenarios.md#ts-05) and the T-NU-41 boundary (4 → `done`, 5 → `confirm`) follow; [Q5](08-project/open-questions.md#q5) is amended. Code and tests follow in #103. (3) The tablet and desktop layout is in v1: [NF-8](05-quality/nfr.md#nf-8) now lists the three layouts, the [overview](01-product/overview.md) drops "desktop layout" from Later and rewords the non-goal, and the [project](08-project/project.md) constraint says responsive from 320px up.
- **Graphite design (V2.1, #97).** [Theme guide](01-product/theme-guide.md) is rewritten for Graphite (monochrome greys, Inter) and replaces Paper & ink; the reference package is not in git and is linked from the guide. [Screens](01-product/screens.md): no serif, "Made from your note" link, round + button. [Overview](01-product/overview.md) and [project](08-project/project.md) name Graphite. [Tasks](08-project/tasks.md) IM-06 maps the Graphite tokens. The UI rework is #98; the `task.created_by_assistant` string changes with it.
- **Note editor layout (#98).** [NC §2.1](03-modules/NC-note-capture.md#21-editor-nc-1-nc-2-nc-5): the editor follows the Graphite New note screen: Cancel and "✦ New note" bar, "Your note" card, helper line, "Try writing" examples, full-width Make tasks. Cancel replaces ×.

## 2026-10-31

- **Closing the note editor (IM-41).** [UX-13](01-product/ux-standards.md#ux-13) and [NC §2.1](03-modules/NC-note-capture.md#21-editor-nc-1-nc-2-nc-5): closing the editor with text asks "Discard this note?" (Discard / Keep editing) instead of closing without asking; Discard clears the draft, which still guards against the app closing mid-note ([NC-E1](03-modules/NC-note-capture.md#nc-e1)). [Copy catalog](01-product/copy-catalog.md) and the NC copy keys add `note.discard_title`, `note.discard_body`, `common.discard_action` and `common.keep_editing`.

## 2026-10-29

- **16:10 (UTC+7) · Layout docs match the built shell.** [UX-24](01-product/ux-standards.md#ux-24): the phone header keeps Search and the avatar. [UX-26](01-product/ux-standards.md#ux-26): the tab bar shrinks to 48px when the viewport is 480px tall or less, and a phone 768px wide or more sideways gets the sidebar. [UX-27](01-product/ux-standards.md#ux-27): follows the Figma desktop frames; sidebar and side panel on `surface`, content on `paper`, capture bar over a paper fade, header without Search and avatar, toasts centred on the column, no sidebar on signed-out screens. [UX-28](01-product/ux-standards.md#ux-28): panel as tall as the window. The UX rows are back in ID order. [Traceability matrix](06-testing/traceability-matrix.md), NF-8 row: adds the 915×412 sideways check. The [UI README](../frontend/src/ui/README.md) lists `AppShell`, `Sidebar`, `px-gutter-wide` and the fonts loaded with `next/font`.
- **Tablet and desktop layout.** [UX-24](01-product/ux-standards.md#ux-24) now covers widths below 768px only. New [UX-27](01-product/ux-standards.md#ux-27): from 768px a sidebar replaces the tab bar and the content is a column up to 712px. New [UX-28](01-product/ux-standards.md#ux-28): from 1280px an optional 400px side panel. The NF-8 row of the [traceability matrix](06-testing/traceability-matrix.md) follows.
- **Layout beyond phone width.** [UX-24](01-product/ux-standards.md#ux-24): from 600px the app stays one centred 600px column, with the capture bar, tab bar, toasts and sheets inside it; no separate tablet or desktop layout. [UX-25](01-product/ux-standards.md#ux-25): side margin of at least 20px plus the side safe-area insets. [UX-26](01-product/ux-standards.md#ux-26): held sideways, the bottom bars stay visible and nothing covers a row or a field.
- **Layout tests.** [Traceability matrix](06-testing/traceability-matrix.md), NF-8 row: adds the 768 and 1280 wide viewports and a sideways 667×375 check. [Test strategy](06-testing/test-strategy.md): the end-to-end row points to those viewports.
- **This changelog** is added and linked from the [README](README.md).
- **Password reset (IM-13).** [AA-E4](03-modules/AA-account-access.md#aa-e4) and [AA §8](03-modules/AA-account-access.md#8-data-validation-and-authorization): resets use Laravel's reset broker, so a new request replaces the old link, only the newest link works, once, and a request within 45 s sends nothing. [NF-13](05-quality/nfr.md#rate-limits-nf-13): setting the new password is limited to 5 a minute and 20 an hour per IP.
- **Sign-in lockout (IM-12).** [Error schema](07-architecture/contracts/schemas/error.schema.json): adds `retry_after` (seconds) for `429 auth.locked`, with the `error-locked.json` fixture.
- **Sessions (IM-10).** [ADR-007](07-architecture/decisions/ADR-007-session-and-auth.md) and [AA](03-modules/AA-account-access.md): *Remember me* lasts 30 days from sign-in instead of a rolling 30 days.

## 2026-10-28

- **Security headers.** [NF-16](05-quality/nfr.md#nf-16), [SC-07](07-architecture/security.md#sc-07), [AP](03-modules/AP-app-platform.md) and the [ASVS checklist](06-testing/asvs-checklist.md): the CSP blocks framing and plugins and has no script allow-list, recorded as ASVS deviation 4 (Next.js inlines its bootstrap scripts).
- **API base (IM-08).** [Copy catalog](01-product/copy-catalog.md): adds `error.invalid` for a 422 without a more specific code.
- **Data model (IM-03).** [Data model](07-architecture/data-model.md): `users.password` holds the hash; `tasks.reminder` defaults to `none`; password resets use Laravel's `password_reset_tokens` table.
- **Contracts (IM-02).** JSON Schemas and fixtures move to [07-architecture/contracts](07-architecture/contracts/), with task, project and error schemas and more note-result fixtures; [API](07-architecture/api.md) and the [README](README.md) link to them.
- **Design system (IM-06).** [Project](08-project/project.md) conventions and [tasks](08-project/tasks.md) IM-06: the design system is built on Tailwind CSS and daisyUI, themed with the Paper & ink tokens.
- **MVP plan.** [Tasks](08-project/tasks.md) adds the MVP task list with owners, linked from the [README](README.md) and [project](08-project/project.md).

## 2026-10-26

- **Business rules and review.** [Business rules](02-domain/business-rules.md) clarified for deletes, the change limit and changes across notes; [RV-3](03-modules/RV-review-control.md#rv-3) acceptance criteria clarified.
- **Docs restructured** for readability, with the open-question decisions applied ([open questions](08-project/open-questions.md)).
- **V2 concept.** The docs are rewritten for notes turned into tasks, replacing the chat with an assistant (concept dated 2026-10-23, see the [README](README.md)).

## 2026-10-15

- First version of the project docs (V1, chat-based). Kept in git history at commit `5ad132a`.
