# LV — Lists & Search

Seeing what matters: Inbox for today and overdue, Upcoming grouped by day, Search across all tasks, and task context in every row.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md), [ADR-006](../07-architecture/decisions/ADR-006-time-zones.md), [TK module](TK-tasks.md)

- **Screens:** Inbox, Upcoming, Search ([screens and navigation](../01-product/screens.md))
- **Workflows:** [WF-06](../04-workflows/WF-06-complete-a-task.md)

LV shows what to do: Inbox (today), Upcoming (by day), Search, and the task row used everywhere. Decisions marked **([Q20](../08-project/open-questions.md#q20))** extend the PRD.

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="lv-1"></a>LV-1 | Show today in Inbox | Must | A summary shows done of total for today; Overdue (in red, with a count) comes before Today; when all are done, "Nothing left for today" links to Upcoming |
| <a id="lv-2"></a>LV-2 | Show what's coming | Must | Upcoming groups tasks by day and filters All / Scheduled / Due only |
| <a id="lv-3"></a>LV-3 | Find any task, project or note | Must | Search covers task titles and notes (completed included), project names and notes, with All / Tasks / Projects / Notes counts; no match shows "Nothing matches “…”" |
| <a id="lv-4"></a>LV-4 | Show task context in every row | Must | Each row shows project dot and name, time, reminder and repeat icons, and a priority flag for High and Medium |

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| App open, Inbox tab | Inbox |
| Upcoming tab, the "See what's coming" link | Upcoming |
| Search in the sidebar, `/` on a list screen, or Ctrl/Cmd+K | Search popup from 768 px, the Search screen below it; field focused |

- As a user opening the app between meetings, I see what's due today and what I missed, in one glance.
- As a user planning my week, I see the next days grouped by day.
- As a user, I find that "ER diagram" task without remembering where it lives.

## 2. Behaviour detail

### 2.1 Inbox (LV-1)

- **Overline:** today's date (`Friday 23 Oct`). On desktop screens (from 768px), an informative subtitle displays the count of overdue and today's tasks (`list.inbox_subtitle`, e.g. "2 overdue · 4 today"), accompanied by a pill-shaped `+ New task` action button in the header. Then the progress summary `list.progress` with `list.encourage_progress`.
- **Card layout:** Section task lists are wrapped in elevated rounded card containers (`rounded-2xl border border-separator/50 bg-surface shadow-xs`) with row hairlines suppressed on the last item (`last:after:hidden`).
- **Live refresh:** The Inbox updates in real time on task creation (`agendal:task-created`), project modifications (`agendal:projects-changed`), window focus, and visibility changes without needing a full browser reload.
- **Sections, in order:**

| Section | Contents |
|---|---|
| Overdue | Open tasks not done and `due_date` before today (date-based). From the due time on the due day the due label turns red, but the task stays in Today until the day ends ([LV-E9](#lv-e9)). Heading in red with the word and a count ("Overdue 2"), so colour isn't the only signal |
| Today | Open tasks whose start date is today, or due date is today, or in progress (start date before today and due date after today), or start-only tasks whose start date has passed ([BR-23](../02-domain/business-rules.md#br-23)) |
| **No date ([Q20](../08-project/open-questions.md#q20))** | Open tasks with no start date and no due date, collapsed by default and showing its count. Without it, every undated task a note makes ("Buy milk") would only be visible under Projects. This section isn't part of the progress |
| Completed | Tasks completed today, collapsed and showing its count. Caps at 5 tasks initially. If more than 5 completed tasks exist, a "Show all" (`list.show_all`) button allows expanding to see all completed tasks, which can then be toggled back via "Show less" (`list.show_less`). Reopening/undoing tasks replenishes visible slots from hidden tasks; once total completed tasks drop to 5 or fewer, the button automatically disappears |

- **Progress:**
  - *Total* = open tasks due today or overdue, plus tasks completed today that were due today or earlier.
  - *Done* = the completed part of that total.
  - Completing an overdue task counts toward today.
- **All done:** when nothing is open in Overdue or Today, `list.nothing_left` shows with the link `list.see_upcoming` and `list.encourage_one`.
- **Sort within Overdue:** oldest due date first. **Within Today:** timed first by start time, then priority (High → Low), then by creation time. **Within No date:** priority, then newest first.
- **Midnight:** the lists recompute at local midnight while the app is open (a timer to the next midnight, re-armed on `visibilitychange`), and whenever the zone changes ([ADR-006](../07-architecture/decisions/ADR-006-time-zones.md)).

### 2.2 Upcoming (LV-2)

- **Layout and views:**
  - Sticky week bar with the month, the week arrows, the week in view as a read-only label (`2 – 8 Nov`) and the days of the week.
  - `>` goes to the first day of the next week (Monday, or the account's week start). `<` goes to the first day of the previous week, or tomorrow when that has passed, and is off on the current week.
  - Today stays in the week as a marker, without a task dot, because Upcoming starts tomorrow.
  - The calendar on the month button has **Overdue** with its count in place of Today. It goes to the Overdue section, and is off when nothing is overdue.
  - Creating a task keeps the day in view.
  - **Overdue section** first: open overdue tasks shown above the upcoming days (or as the first column in Board view).
  - **List view:** rolling 2-week window.
  - **Board view:** one week of columns, Overdue column first.
- **Day groups:** tasks from tomorrow on, grouped by day, with headings Tomorrow, then `Mon 26 Oct` ([UX-32](../01-product/ux-standards.md#ux-32)). Every day is shown with a "+ Add task" action button (empty days are shown; this replaces "Days with nothing due aren't shown").
- **Task entries:**
  - A task appears on its **start date** AND on its **due date** (shown once when they are the same day).
  - On its due date, it is shown in a **dashed blue card** (1.5 px dashed border in the project blue, very light blue fill, "Due HH:MM" in blue).
  - **List:** normal entries of a day share one card and due entries share one dashed block below it, split by a dashed line. **Board:** one card per entry, normal ones first.
- **Filters** (chips, remembered per device):
  - **All:** every upcoming entry, start days and due days.
  - **Scheduled:** start-day entries of tasks with a start date, plus repeating tasks when IM-31 lands. Every entry here is a normal card, also for a task that starts and is due the same day.
  - **Due only:** due-day entries of tasks with a due date.
- **Sort within a day:** same as Today (timed first by start time, then priority (High → Low), then created). Completed tasks aren't shown.
- **Repeating tasks** show only their existing next occurrence. Future occurrences aren't projected ([TK §2.3](TK-tasks.md#23-repeating-tasks-tk-4)).
- **Empty:** empty days show "+ Add task"; if no tasks exist anywhere in the window, shows `list.upcoming_empty`.

### 2.3 Search (LV-3)

- **When it runs:**
  - **From 768 px:** a popup over the current screen, on the same blurred backdrop as the task panel, and the page behind doesn't scroll; clicking the backdrop or Esc closes it. `/search` opens the popup over Inbox. Below 768 px: the full Search screen with Cancel.
  - The field is focused on open. Search runs 250 ms after the last keystroke, with 1 character minimum.
  - Enter runs it at once, or opens the active row. ↑ and ↓ move through the rows. No key hints are shown.
  - **Before typing:** Quick filters (Overdue, Due this week, Starts today, High priority, From a note, Completed), Recent searches (the last 5, on this device only, cleared at sign-out), Notes (empty until the Notes screen is done) and Search in a project. Quick filters and the project work with an empty field.
  - The query is capped at 100 characters ([NF-14](../05-quality/nfr.md#nf-14)).
- **Matching:**
  - Tasks: over titles and notes, completed tasks included
  - Projects: over names, on the client
  - Notes: over the name and text, newest first, at most 20; a result carries a short snippet, never the whole note
  - Results show Tasks, Notes, then Projects. The Notes section stays, with "No notes found", during a text search
  - **Case-insensitive.** A word typed without accents ignores accents: "bai tap" finds "Bài tập", "cafe" finds "café"
  - **A word typed with accents keeps them:** "bài" finds "Bài", not "Bãi". It also finds text typed without accents ("Bai"), when the word has 2 letters or more
  - Old and new tone placement are the same word: "hoà" and "hòa", "thuỷ" and "thủy"
  - A word of 1 or 2 letters matches only at the start of a word: "u" finds "Update", not "outline". Longer words match anywhere: "sql" finds "PostgreSQL"
  - All query words must match, in any order and in any field
- **Ranking:**
  1. Title matches before notes-only matches
  2. Then open before completed
  3. Then by due date (soonest first, no date last)
- **Chips:** All / Tasks / Projects / Notes. Each count reflects the current query. The popup also has an Any project filter. With a quick filter or a project set, only tasks show.
- **Highlight:** matched words in titles, project names and note snippets are marked. It is built by splitting the text, never by injecting HTML ([SC-08](../07-architecture/security.md#sc-08)).
- **Opening a result:**
  - A task closes the popup and opens the task panel from 1280 px, on Inbox, Upcoming or a project, else on Inbox. Below 1280 px: the task screen. A task that isn't in the list on screen is loaded by id.
  - A project closes the popup and opens that project.
  - A note does nothing yet (the Notes screen isn't built).
- **Loading:** from the first keystroke until the answer has arrived and 200 ms more has passed, only the skeleton shows, so "no match" never flashes. An answer to an older query is dropped.
- **Pages:** 50 results per page, keyset.
- **Empty:**
  - No query → hint `search.hint`
  - No match → `search.no_match`
- **Offline:**
  - Searches the tasks on the device (IndexedDB) with the same normalisation.
  - A footer `search.offline` notes that older completed tasks may be missing, because the device keeps completed tasks for 90 days (AP).

### 2.4 Task row (LV-4)

- **Layout:**
  - Checkbox (44 px hit area)
  - Title (2 lines max, [UX-30](../01-product/ux-standards.md#ux-30))
  - Meta line:
    - On its start day: `HH:MM · Due {date}`; same-day block: `HH:MM – HH:MM` (start – due time)
    - In between (in progress): `In progress · Due {when}`
    - On its due day: rendered in a dashed blue card with `Due HH:MM` in blue
    - Overdue rows: red
    - Start-only passed: `Planned {date} · HH:MM` in tertiary ink
    - In Overdue, Search and No date, the meta line starts with the due date (`Wed 21 Oct`)
    - Project dot and name · reminder icon · repeat icon
  - Priority flag for High (danger) and Medium (warning). Low gets no flag
- **Interaction:** tapping the row opens details. Tapping the checkbox completes it (TK). There are no swipe gestures, which avoids conflicts with the browser's back gesture.
- **A row with a sync conflict** shows a small "Changed on another device" marker until opened (AP).

## 3. State matrix

| Screen | Empty | Loading | Success | Partial | Error | Offline |
|---|---|---|---|---|---|---|
| Inbox | `list.nothing_left` with links (or a first-run state, `list.first_run`, when the user has no tasks at all) | First load: skeleton after 300 ms. After that, from IndexedDB at once | Sections | Collapsed sections show their counts | Sync failure: cached data and a quiet retry. After 3 failures, `error.save_failed`-style toast | Banner `app.offline`. Everything editable |
| Upcoming | Empty week shows days with "+ Add task" (`list.upcoming_empty` if window has no tasks) | Skeleton cards after 300 ms | Day groups / columns with week bar | Loading next batch: skeleton cards | "(Ref …)" error alert with Retry, or banner if offline | Cached days |
| Search | Quick filters, recent searches, projects | Skeleton until the answer + 200 ms | Results with counts | — | `error.generic` with Retry | Local results plus `search.offline` |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| <a id="lv-e1"></a>LV-E1 | The app is open across midnight | Lists recompute at 00:00 local. Yesterday's open tasks move to Overdue | T-LV-101 |
| <a id="lv-e2"></a>LV-E2 | Travelling across zones | "Today" follows the device zone. Floating due dates don't move ([ADR-006](../07-architecture/decisions/ADR-006-time-zones.md)) | T-LV-102 |
| <a id="lv-e3"></a>LV-E3 | Completing an overdue task | It counts in today's progress. The row moves to Completed | T-LV-103 |
| <a id="lv-e4"></a>LV-E4 | A task with no date | Inbox No date section ([Q20](../08-project/open-questions.md#q20)), its project, and Search | T-LV-104 |
| <a id="lv-e5"></a>LV-E5 | Search with Vietnamese diacritics, or without them | Without accents: ignores accents. With accents: the same accents, or text typed without accents. See [§2.3](#23-search-lv-3) | T-LV-105 |
| <a id="lv-e6"></a>LV-E6 | Search query with `%`, `_` or quotes | Treated as literal text. Parameterised, with `LIKE` wildcards escaped | T-LV-106, SEC-22 |
| <a id="lv-e7"></a>LV-E7 | A task matches in both title and notes | Listed once, ranked as a title match | T-LV-107 |
| <a id="lv-e8"></a>LV-E8 | 5,000 tasks | Inbox, Upcoming and Search stay within read p95 ≤ 300 ms (PERF-05) | PERF-05 |
| <a id="lv-e9"></a>LV-E9 | A task due today with its time already passed | Stays in Today, not Overdue. Overdue is by date only. Due label turns red from due time | T-LV-109 |
| <a id="lv-e10"></a>LV-E10 | A scheduled task with no due date (start-only) | Start-only task has its start time on the start date; passed start day rolls into Today as "Planned {date}" ([BR-23](../02-domain/business-rules.md#br-23)) | T-LV-110 |
| <a id="lv-e11"></a>LV-E11 | Completing the last open task of today | Shows `list.nothing_left`. Focus moves to its heading so screen readers hear it | T-LV-111 |
| <a id="lv-e12"></a>LV-E12 | The Upcoming filter leaves no results | `list.filter_empty` with a "Show all" link | T-LV-112 |

## 5. Copy keys

`list.progress`, `list.encourage_one`, `list.encourage_progress`, `list.overdue`, `list.today`, `list.no_date`, `list.completed`, `list.show_all`, `list.show_less`, `list.inbox_subtitle`, `list.tomorrow`, `list.nothing_left`, `list.see_upcoming`, `list.first_run`, `list.filter_all`, `list.filter_scheduled`, `list.filter_due`, `list.filter_empty`, `list.upcoming_empty`, `search.placeholder`, `search.hint`, `search.filter_open`, `search.filter_completed`, `search.no_match`, `search.offline`, `app.offline`.

## 6. Accessibility

- Each section is a heading with a list. Counts are part of the heading text ("Overdue, 2 tasks"). A11Y-50
- Row accessible name: "{title}, {due}, {time}, {project}, {priority} priority, reminder set, repeats {repeat}". Decorative icons are hidden. A11Y-51
- Filter chips are a radio group. Search result counts are announced politely when they change. A11Y-52
- Collapsed sections are disclosure buttons with `aria-expanded`. A11Y-53

## 7. API contract

| Endpoint | Request | Success |
|---|---|---|
| `GET /tasks?view=inbox` | — | `200 {overdue[], today[], no_date[], completed_today[], progress: {done, total}}` (bounded by date, so no pagination. No date and Completed are capped at 200 each, with a count) |
| `GET /tasks?view=upcoming&from=&days=14&filter=all\|scheduled\|due` | — | `200 {days: [{date, tasks[]}], next_from}` |
| `GET /tasks/search?q=&status=all\|open\|completed&filter=overdue\|due_week\|starts_today\|high_priority\|from_note&project_id=&cursor=` | — | `200 {items[], counts: {all, open, completed}, next_cursor}`. `422` for a wrong type, null byte, invalid UTF-8, unknown `status` or `filter`, or a forged `cursor`. `404` for a `project_id` the user doesn't own |
| `GET /notes/search?q=` | — | `200 {items: [{id, title, snippet, status, written_at}]}`, at most 20. `422` as above. Own rate limit `search-notes`, 60 a minute |

- **Errors:** `401`. `422` for a bad `view` or `filter`. `429` for search beyond 60/min.
- **Queries:** Inbox and Upcoming queries evaluate both `start_date` and `due_date`. Upcoming returns both start-day and due-day entries (tasks with both dates appear under each day; single entry if start and due are the same day). The endpoint `GET /tasks?view=upcoming&from=&days=14&filter=all|scheduled|due` keeps an unchanged response shape.
- **"Today":** every list endpoint computes it from `X-Timezone` ([ADR-006](../07-architecture/decisions/ADR-006-time-zones.md)).
- **Offline:** the client normally renders from IndexedDB, which sync keeps current ([ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)). These endpoints serve the first load and Search.

## 8. Data, validation and authorization

- **Queries:** scoped by `user_id`, using `tasks (user_id, start_date)`, `tasks (user_id, due_date)`, `tasks (user_id, done)` and the trigram index.
- **Accent-insensitive search** uses PostgreSQL `unaccent` with a trigram GIN index on the unaccented title and notes ([data model](../07-architecture/data-model.md)).
- **Search query:** parameterised. It isn't logged in access logs (ASVS 8.3.1 deviation).

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Search used to probe other users' data | Scoped by `user_id` | SEC-12 |
| Expensive search spam | 60/min, 100-character cap, keyset pages | SEC-10, SEC-11 |
| Injection through the query | Parameterised, escaped | SEC-22 |

## 10. Performance and scaling

- Read p95 ≤ 300 ms with 5,000 tasks (PERF-05). After first load, lists render from IndexedDB in under 100 ms.
- Inbox is one query, split into sections in code. Upcoming uses a 14-day range scan on `(user_id, due_date)`.

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [LV-1](#lv-1) | A summary shows done of total for today | T-LV-01 (progress math, including overdue completed today) |
| [LV-1](#lv-1) | Overdue (red, with a count) before Today | T-LV-02 (order and sort), T-LV-03 (word and count present, not colour alone) |
| [LV-1](#lv-1) | All done → "Nothing left for today" links to Upcoming | T-LV-04, T-LV-111 |
| [LV-2](#lv-2) | Upcoming groups tasks by day | T-LV-10 (headings, sort, 14-day paging) |
| [LV-2](#lv-2) | Filters All / Scheduled / Due only | T-LV-11, T-LV-112 |
| [LV-3](#lv-3) | Search covers titles and notes, completed included | T-LV-20, T-LV-105–107 |
| [LV-3](#lv-3) | All / Tasks / Projects / Notes counts | T-LV-21 |
| [LV-3](#lv-3) | No match shows "Nothing matches “…”" | T-LV-22 |
| [LV-4](#lv-4) | Each row shows project dot and name, time, reminder and repeat icons, and a High/Medium flag | T-LV-30 (component, every combination), A11Y-51 |
| — | Edge cases [LV-E1](#lv-e1)–[LV-E12](#lv-e12) | T-LV-101–112, PERF-05 |
| — | Accessibility | A11Y-50–53 |
