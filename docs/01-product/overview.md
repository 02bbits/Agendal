# Product Overview

Agendal is a mobile web app (PWA). You write or say whatever is on your mind, and Agendal turns it into dated, organised tasks that you can review and undo. The note comes first; lists come second.

> *"sql quiz monday 9am, email the group tonight, buy printer ink tomorrow"* → three tasks: **SQL quiz** (Mon 09:00, High, SQL Course, reminder 1 day before), **Email the group** (today 20:00, Medium, reminder 15 minutes before), **Buy printer ink** (tomorrow, Low). The note is named "This week".

Agendal is a course demo project (VNUK *Advanced Web Development*). It has no launch, beta or business metrics.

## How it works

1. **Write a note**: typed, dictated, or read from a file, in English or Vietnamese. No fields to fill in.
2. **Agendal builds a plan**: the tasks to create, change or delete, and any text to skip ([business rules](../02-domain/business-rules.md)).
3. **Risky plans wait**: any delete, or more than 5 changes, needs *Apply changes* first. A note with nothing actionable gets one question.
4. **The result screen** lists every change. **Undo all** reverses the whole note, and **Edit note** re-plans it.

## Problem

People get tasks in bursts: a meeting sets a deadline, a group chat agrees on a date, an errand comes up on the walk home. Most to-do apps make you stop and fill in a form for each one (title, date, time, project, priority). That friction means tasks end up in notes apps, chats or memory, and get missed.

**The idea:** keep capture as cheap as writing a note. The user writes one line with several things in it, and Agendal splits it into tasks, finds the dates, times, projects and priorities, and shows exactly what it did. The user stays in control: every change is listed, editable and undoable.

**Why notes instead of chat:** the earlier design (V1) had a chat with an assistant. A note is written once and turned into tasks, with no conversation to manage. The assistant asks a question only when a note is unclear or a change is risky.

## Users and roles

| User | Needs | What Agendal does |
|---|---|---|
| Busy user (primary) | Get things out of their head in seconds. See what is due today. Never miss a deadline | Notes in, tasks out. Inbox shows today and overdue. Reminders before exams and timed tasks |
| Team member | Turn meeting notes into dated tasks | Paste or attach the notes. Agendal makes one task per action item |
| Planner | Full control over each task | The + button opens a manual New task sheet. Every field is editable afterwards |
| Low-vision or keyboard user | Readable contrast, labelled controls, visible focus | WCAG 2.2 AA colours, 44px targets, labelled icon buttons, focus rings |

| Role | Can do |
|---|---|
| Guest | Create an account, sign in, reset a password ([AA-1](../03-modules/AA-account-access.md#aa-1)–4) |
| Account holder | Everything, on **their own** notes, tasks and projects only ([NF-9](../05-quality/nfr.md#nf-9)). There is no admin role |

**System actors:** the assistant (reads a note and builds a plan, within the [safety rules](../02-domain/business-rules.md#safety-rules)), the device's service worker (offline data and sync, [NF-6](../05-quality/nfr.md#nf-6)), an email service (reset links, [AA-4](../03-modules/AA-account-access.md#aa-4)), Web Push (reminders, [TK-6](../03-modules/TK-tasks.md#tk-6)), Google Cloud Vision (OCR for photos and scanned PDFs, [NC-4](../03-modules/NC-note-capture.md#nc-4)) and OpenRouter (the language-model fallback, [ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)).

## Goals

1. Capturing several tasks takes one note and under 15 seconds.
2. The assistant is right often enough to trust. When it is wrong, fixing or undoing it takes one tap.
3. Users see what needs doing today at a glance, every time they open the app.
4. It works offline and installs like an app on any modern phone.

## Non-goals for v1

- Shared lists, or assigning tasks to other people
- Calendar sync
- Chat with the assistant
- A desktop-first layout
- Native iOS or Android apps
- Account deletion and data export ([Q7](../08-project/open-questions.md#q7))
- A user interface in Vietnamese. Notes can be in Vietnamese, but the UI is English ([Q3](../08-project/open-questions.md#q3))

## Release plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. MVP** | Every **Must**: account and access, typed notes, note understanding (English and Vietnamese) with review and Undo all, tasks, Inbox / Upcoming / Search, projects, offline, install, light and dark, editing a note ([RV-5](../03-modules/RV-review-control.md#rv-5)), week start and time format ([AP-5](../03-modules/AP-app-platform.md#ap-5)) | All Must acceptance criteria pass. Accessibility audit passes [NF-1](../05-quality/nfr.md#nf-1) to [NF-3](../05-quality/nfr.md#nf-3). The note corpus passes its accuracy gates |
| **2. v1.1** | **Should** items: voice notes ([NC-3](../03-modules/NC-note-capture.md#nc-3)), files as notes ([NC-4](../03-modules/NC-note-capture.md#nc-4)), note names ([NU-6](../03-modules/NU-note-understanding.md#nu-6)), assistant label ([NU-7](../03-modules/NU-note-understanding.md#nu-7)), reminders ([TK-6](../03-modules/TK-tasks.md#tk-6)), project rename and colour ([PJ-3](../03-modules/PJ-projects.md#pj-3)) | All Should acceptance criteria pass |
| **3. Later** | **Could** items (examples, [NC-5](../03-modules/NC-note-capture.md#nc-5)) and candidates: calendar view, shared projects, account deletion and export, smarter project suggestions, desktop layout | — |

**Platforms:** phones 320–480px wide (360px reference), with a centred column up to 600px ([NF-8](../05-quality/nfr.md#nf-8)). The last two versions of Chrome, Safari (iOS 16.4+), Samsung Internet, Firefox and Edge ([NF-7](../05-quality/nfr.md#nf-7)).

## What changed from V1

| V1 (chat assistant) | V2 (notes) |
|---|---|
| A back-and-forth chat with an assistant, with conversation history | A note is written once and turned into tasks. History is the Notes tab |
| The assistant also split tasks, found free time, answered "What should I do next?" | Not in v1. The assistant only creates, completes, reschedules and deletes tasks |
| Encouragement, nudges and morning summary, each with a toggle | A completion toast with Undo. No nudges or morning summary |
| Summary card per assistant reply | Note result screen with CREATED / UPDATED / DELETED badges |
| Requirement IDs FR-01–FR-67, NFR-1–NFR-27 | AA, NC, NU, RV, TK, LV, PJ, AP and NF ([ID lookup](../README.md#id-lookup)) |

## Design

The look is **Paper & ink**: a calm, flat notebook in light and dark. See the [theme guide](theme-guide.md), the [design system](https://claude.ai/artifact/1tqQg3Ugsmxm6qJWyXaYpu) and the [prototype](https://claude.ai/artifact/7uABDQJSswS3pUAeSFNag8) (sign in with example@gmail.com).
