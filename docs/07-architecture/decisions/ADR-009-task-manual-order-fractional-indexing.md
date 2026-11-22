# ADR-009 — Task Manual Order via Fractional Indexing and Dual Sort Modes

**Status:** Accepted.

## Context
Agendal automatically organizes tasks using smart rules (groups by deadline/start, time, priority, creation date; LV §2.1, §2.2). Users also need the ability to manually reorder tasks via drag and drop (#178) to prioritize their daily focus or customize project backlogs.

Naively using sequential integer positions (`1, 2, 3...`) requires re-numbering subsequent rows whenever a task is inserted or moved. In Agendal's offline architecture (ADR-004, ADR-005), updating dozens of tasks simultaneously creates mass patch queues, wastes sync bandwidth, and causes merge collisions. Furthermore, a task has different priorities depending on context: its sequence in a project backlog differs from its sequence in a daily schedule (Today).

## Decision
- **Dual ordering keys:**
  - `project_order`: The task's manual sequence inside its project or Inbox "No date".
  - `day_order`: The task's manual sequence in Today or a specific day in Upcoming.
- **Fractional indexing:**
  - Order keys are string-based fractional indices generated via `fractional-indexing`.
  - Reordering a task generates a string between its new neighbours (e.g. between `"a0"` and `"a1"` $\rightarrow$ `"a0V"`).
  - Dragging a task updates **only that single task's field** (`project_order` or `day_order`) via standard field-level LWW (ADR-004). No other rows are touched.
- **Order lifecycle:**
  - Changing a task's date (or moving to another day) clears `day_order` unless a new `day_order` is provided with the drop.
  - Changing a task's project clears `project_order`.
- **Dual sort modes (Smart vs Manual):**
  - Each list remembers its preferred sort mode (`smart` or `manual`) in local storage.
  - **Defaults:** Today and Upcoming default to `smart`. Projects and No date default to `manual`.
  - **Drag interaction in Smart mode:** Dragging a task automatically switches the list to `manual` and surfaces a Toast (`"Switched to manual order · Undo"`).
  - **Sort by rules:** A toolbar action re-evaluates the smart rules for the current list, generates evenly-spaced fractional keys, and applies them in a single batch request (`/sync/patches`) while remaining in manual mode.

## Consequences
- Every manual reorder operation is $O(1)$ database writes and requires no table-wide re-indexing or background re-balancing.
- Offline drag and drop merges cleanly without race conditions or data loss.
- Users enjoy both zero-effort rule-based sorting and full manual drag-and-drop autonomy.
