# M06 Lists & Search — Spec

**Status:** Ready (approved 2026-10-26) · **Requirements:** [prd.md](prd.md) · **Depends on:** [ADR-005](../../07-architecture/technical-decisions/ADR-005-sync-protocol.md), [ADR-006](../../07-architecture/technical-decisions/ADR-006-time-zones.md), [M05 spec](../M05-tasks/spec.md)

M06 shows what to do: Inbox (today), Upcoming (by day), Search, and the task row used everywhere. Decisions marked **(Q20)** extend the PRD.

## 1. Entry points and user stories

| Entry | Screen |
|---|---|
| App open, Inbox tab | Inbox |
| Upcoming tab, the "See what's coming" link | Upcoming |
| Search icon, or `/` on a list screen | Search, field focused |

- As a student opening the app between classes, I see what's due today and what I missed, in one glance.
- As a student planning my week, I see the next days grouped by day.
- As a student, I find that "ER diagram" task without remembering where it lives.

## 2. Behaviour detail

### 2.1 Inbox (LV-1)

- **Overline:** today's date (`Friday 23 Oct`). Then the progress summary `list.progress` with `list.encourage_progress`.
- **Sections, in order:**

| Section | Contents |
|---|---|
| Overdue | Open tasks due before today. Heading in red with the word and a count ("Overdue 2"), so colour isn't the only signal |
| Today | Open tasks due today |
| **No date (Q20)** | Open tasks with no due date, collapsed by default and showing its count. Without it, every undated task a note makes ("Buy milk") would only be visible under Projects. This section isn't part of the progress |
| Completed | Tasks completed today, collapsed and showing its count |

- **Progress:**
  - *Total* = open tasks due today or overdue, plus tasks completed today that were due today or earlier.
  - *Done* = the completed part of that total.
  - Completing an overdue task counts toward today.
- **All done:** when nothing is open in Overdue or Today, `list.nothing_left` shows with the link `list.see_upcoming` and `list.encourage_one`.
- **Sort within Overdue:** oldest due date first. **Within Today:** timed tasks by start time, then untimed tasks by priority (High → Low), then by creation time. **Within No date:** priority, then newest first.
- **Midnight:** the lists recompute at local midnight while the app is open (a timer to the next midnight, re-armed on `visibilitychange`), and whenever the zone changes (ADR-006).

### 2.2 Upcoming (LV-2)

- **Groups:** tasks due from tomorrow on, grouped by day, with headings Tomorrow, then `Mon 26 Oct` (UX-32). Days with nothing due aren't shown.
- **Loading:** 14 days at a time. Scrolling loads the next 14 (keyset on `due_date`). A long gap simply moves on to the next date with tasks.
- **Filters** (chips, remembered per device):
  - **All**
  - **Scheduled:** has a start time
  - **Due only:** has a due date and no start time
- **Sort within a day:** same as Today. Completed tasks aren't shown.
- **Repeating tasks** show only their existing next occurrence. Future occurrences aren't projected (M05 §2.3).
- **Empty:** `list.upcoming_empty`.

### 2.3 Search (LV-3)

- **When it runs:**
  - The field is focused on open. Search runs 250 ms after the last keystroke, with 1 character minimum.
  - Enter runs it at once.
  - The query is capped at 100 characters (NF-14).
- **Matching:**
  - Over titles and notes, completed tasks included
  - **Case- and accent-insensitive:** "bai tap" finds "Bài tập", "cafe" finds "café"
  - All query words must match, in any order and in any field
- **Ranking:**
  1. Title matches before notes-only matches
  2. Then open before completed
  3. Then by due date (soonest first, no date last)
- **Chips:** All / Open / Completed. Each count reflects the current query.
- **Highlight:** matched words in titles are bold. It is built by splitting the text, never by injecting HTML (SC-08).
- **Pages:** 50 results per page, keyset.
- **Empty:**
  - No query → hint `search.hint`
  - No match → `search.no_match`
- **Offline:**
  - Searches the tasks on the device (IndexedDB) with the same normalisation.
  - A footer `search.offline` notes that older completed tasks may be missing, because the device keeps completed tasks for 90 days (M08).

### 2.4 Task row (LV-4)

- **Layout:**
  - Checkbox (44 px hit area)
  - Title (2 lines max, UX-30)
  - Meta line: project dot and name · time (or `16:00 – 17:00`) · reminder icon · repeat icon
  - Priority flag for High (danger) and Medium (warning). Low gets no flag
  - In Overdue, Search and No date, the meta line starts with the due date (`Wed 21 Oct`)
- **Interaction:** tapping the row opens details. Tapping the checkbox completes it (M05). There are no swipe gestures, which avoids conflicts with the browser's back gesture.
- **A row with a sync conflict** shows a small "Changed on another device" marker until opened (M08).

## 3. State matrix

| Screen | Empty | Loading | Success | Partial | Error | Offline |
|---|---|---|---|---|---|---|
| Inbox | `list.nothing_left` with links (or a first-run state, `list.first_run`, when the user has no tasks at all) | First load: skeleton after 300 ms. After that, from IndexedDB at once | Sections | Collapsed sections show their counts | Sync failure: cached data and a quiet retry. After 3 failures, `error.save_failed`-style toast | Banner `app.offline`. Everything editable |
| Upcoming | `list.upcoming_empty` | Same | Day groups | Loading the next 14 days: a row skeleton at the end | Load-more failure: inline Retry | Cached days |
| Search | `search.hint` | Results skeleton after 300 ms | Results with counts | — | `error.generic` with Retry | Local results plus `search.offline` |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| E1 | The app is open across midnight | Lists recompute at 00:00 local. Yesterday's open tasks move to Overdue | T-LV-101 |
| E2 | Travelling across zones | "Today" follows the device zone. Floating due dates don't move (ADR-006) | T-LV-102 |
| E3 | Completing an overdue task | It counts in today's progress. The row moves to Completed | T-LV-103 |
| E4 | A task with no date | Inbox No date section (Q20), its project, and Search | T-LV-104 |
| E5 | Search with Vietnamese diacritics, or without them | Accent-insensitive both ways | T-LV-105 |
| E6 | Search query with `%`, `_` or quotes | Treated as literal text. Parameterised, with full-text special characters escaped | T-LV-106, SEC-22 |
| E7 | A task matches in both title and notes | Listed once, ranked as a title match | T-LV-107 |
| E8 | 5,000 tasks | Inbox, Upcoming and Search stay within read p95 ≤ 300 ms (PERF-05) | PERF-05 |
| E9 | A task due today with its time already passed | Stays in Today, not Overdue. Overdue is by date only | T-LV-109 |
| E10 | A scheduled task with no due date | Can't happen: a start time sets the due date (M05) | T-LV-110 |
| E11 | Completing the last open task of today | Shows `list.nothing_left`. Focus moves to its heading so screen readers hear it | T-LV-111 |
| E12 | The Upcoming filter leaves no results | `list.filter_empty` with a "Show all" link | T-LV-112 |

## 5. Copy keys

`list.progress`, `list.encourage_one`, `list.encourage_progress`, `list.overdue`, `list.today`, `list.no_date`, `list.completed`, `list.tomorrow`, `list.nothing_left`, `list.see_upcoming`, `list.first_run`, `list.filter_all`, `list.filter_scheduled`, `list.filter_due`, `list.filter_empty`, `list.upcoming_empty`, `search.placeholder`, `search.hint`, `search.filter_open`, `search.filter_completed`, `search.no_match`, `search.offline`, `app.offline`.

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
| `GET /tasks/search?q=&status=all\|open\|completed&cursor=` | — | `200 {items[], counts: {all, open, completed}, next_cursor}` |

- **Errors:** `401`. `422` for a bad `view` or `filter`. `429` for search beyond 60/min.
- **"Today":** every list endpoint computes it from `X-Timezone` (ADR-006).
- **Offline:** the client normally renders from IndexedDB, which sync keeps current (ADR-005). These endpoints serve the first load and Search.

## 8. Data, validation and authorization

- **Queries:** scoped by `user_id`, using `tasks (user_id, due_date)`, `tasks (user_id, done)` and the full-text index.
- **Accent-insensitive search** needs DB support: `unaccent` with a matching index on PostgreSQL, or an accent-insensitive collation on MySQL (Q14). Both work. The test asserts the behaviour, not the engine.
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

## 11. Analytics

| Event | Properties | Feeds |
|---|---|---|
| `session_started` | online, installed | Weekly retention |
| `list_viewed` | view (inbox, upcoming, search), counts by section | Engagement |
| `search_performed` | result count bucket, status filter. **No query text** | Search usefulness |

## 12. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| LV-1 | A summary shows done of total for today | T-LV-01 (progress math, including overdue completed today) |
| LV-1 | Overdue (red, with a count) before Today | T-LV-02 (order and sort), T-LV-03 (word and count present, not colour alone) |
| LV-1 | All done → "Nothing left for today" links to Upcoming | T-LV-04, T-LV-111 |
| LV-2 | Upcoming groups tasks by day | T-LV-10 (headings, sort, 14-day paging) |
| LV-2 | Filters All / Scheduled / Due only | T-LV-11, T-LV-112 |
| LV-3 | Search covers titles and notes, completed included | T-LV-20, T-LV-105–107 |
| LV-3 | All / Open / Completed counts | T-LV-21 |
| LV-3 | No match shows "No tasks match “…”" | T-LV-22 |
| LV-4 | Each row shows project dot and name, time, reminder and repeat icons, and a High/Medium flag | T-LV-30 (component, every combination), A11Y-51 |
| — | Edge cases E1–E12 | T-LV-101–112, PERF-05 |
| — | Accessibility | A11Y-50–53 |
