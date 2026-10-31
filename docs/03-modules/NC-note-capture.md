# NC — Note Capture

Getting things out of the user's head: a one-tap note editor (typed, dictated or from a file), offline capture, and the manual New task sheet for planners.

**Status:** Ready (approved 2026-10-26) · **Depends on:** [ADR-003](../07-architecture/decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-006](../07-architecture/decisions/ADR-006-time-zones.md), [NU module](NU-note-understanding.md), [security NF-17](../05-quality/nfr.md#security-and-privacy)

- **Screens:** Capture bar, Note editor, New task sheet ([screens and navigation](../01-product/screens.md))
- **Workflows:** [WF-01](../04-workflows/WF-01-capture-and-process-note.md), [WF-05](../04-workflows/WF-05-offline-capture-and-sync.md)

NC gets text into Agendal: the capture bar, the note editor (typed, dictated, from a file), offline capture, and the manual New task sheet. Decisions marked **([Q20](../08-project/open-questions.md#q20))** extend the PRD.

## Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| <a id="nc-1"></a>NC-1 | Open the note editor in one tap from any list screen | Must | The capture bar and the Notes tab open a full-screen editor with the cursor in the text; examples show while it is empty |
| <a id="nc-2"></a>NC-2 | Write a free-text note containing several tasks | Must | No fields are required; Make tasks is enabled as soon as there is text |
| <a id="nc-3"></a>NC-3 | Dictate a note | Should | The mic shows "Listening…" with Stop; the recognised text lands in the editor to check ("Here's what I heard."); Make tasks is disabled while listening |
| <a id="nc-4"></a>NC-4 | Turn a file into a note | Should | Accepts text, Markdown, CSV, PDF, Word and photos up to 5 MB; extracted text lands in the editor to check; a removable file chip shows; unsupported or oversized files get a specific error; the result shows "From \<file name>" |
| <a id="nc-5"></a>NC-5 | Start from an example | Could | Tapping an example chip fills the editor |
| <a id="nc-6"></a>NC-6 | Capture while offline | Must | The button reads Save note; the note is stored on the device as "Waiting for connection"; on reconnect it is processed automatically with a toast "Back online. N notes turned into M tasks." |
| <a id="nc-7"></a>NC-7 | Add a task by hand | Must | The + button opens New task: only a title is required; due chips Today, Tomorrow, Next week, No date, Pick date…; priority; project; a toast confirms "Added “…”" |

## 1. Entry points and user stories

| Entry | Opens |
|---|---|
| Capture bar "Write a note…" (every list screen) | Editor, cursor in the text |
| Capture bar mic | Editor, dictation already started |
| Notes tab, Write a note (empty state) | Editor |
| `+` button (every list screen) | New task sheet |

- As a user with a spare minute, I tap once and type, so that capture takes seconds.
- As a user walking, I dictate instead of typing.
- As a group member, I attach meeting notes, so that each action item becomes a task.
- As a user on a train with no signal, I still save notes.
- As a planner, I add one task by hand with only a title.

## 2. Behaviour detail

### 2.1 Editor (NC-1, NC-2, NC-5)

- **Layout:** full screen. Close (×) top-left, the serif text area, then a bottom bar with the mic, the paperclip and Make tasks. The bar sits above the keyboard ([UX-20](../01-product/ux-standards.md#ux-20)).
- **Focus:** the text area is focused inside the tap handler, so iOS opens the keyboard (focusing after an `await` doesn't).
- **Examples** show while the text is empty: 3 chips ("sql quiz monday 9am, email the group tonight", "done email the group", "move gym to sunday"). A chip replaces the empty text and keeps focus at the end ([NC-5](#nc-5)).
- **Make tasks** is enabled when the text has a visible character ([NU-E15](NU-note-understanding.md#nu-e15)), and not while listening or reading a file. Ctrl/Cmd+Enter submits ([UX-12](../01-product/ux-standards.md#ux-12)).
- **Counter:** hidden below 4,500 characters. From 4,500 it shows `4,612 / 5,000`. Above 5,000 it turns red with `note.too_long`, and Make tasks is disabled ([NF-14](../05-quality/nfr.md#nf-14)).
- **Paste:** the text area is plain text, so formatting is dropped by the platform. A paste that crosses 5,000 characters is kept in full and shows the counter error, so nothing the user pasted is lost silently.
- **Draft ([UX-13](../01-product/ux-standards.md#ux-13)):**
  - The text is saved to IndexedDB 500 ms after the last keystroke, and on `pagehide` / `visibilitychange`.
  - Opening the editor restores it with `note.draft_restored`.
  - A successful submit clears it.
  - One draft per user per device. It is wiped on sign-out ([NF-19](../05-quality/nfr.md#nf-19)).
- **Close:** an empty editor closes at once. With text, × , Escape and Back ask `note.discard_title` with *Discard* and *Keep editing*. Discard clears the draft and closes; Keep editing returns to the text. The draft is for when the app closes mid-note ([NC-E1](#nc-e1)).

### 2.2 Submit

- **Online:**
  - The client generates `client_id` (UUID v4) and `written_at` (with offset), and reads `timezone` from `Intl`.
  - It posts to `POST /notes`, shows `note.reading` after 300 ms, then replaces the editor with the RV screen.
  - A network error or `5xx` queues the note ([NU §3](NU-note-understanding.md#3-state-matrix)).
- **Offline:**
  - The button reads `note.save_offline`.
  - The note is written to IndexedDB with the same fields and status `pending`.
  - The editor closes with the toast `note.saved_offline`.
  - The Notes tab shows the card with `note.waiting` ([NC-6](#nc-6)).
- **Storage write fails** (quota or private mode): the text stays in the editor with `app.storage_low`. Nothing is lost.
- **Replay:** on reconnect, oldest first ([ADR-003](../07-architecture/decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)), then one toast `note.back_online_*` (plus `note.needs_look_*`).

### 2.3 Dictation (NC-3, Should)

- **Engine:** the browser's Web Speech API (decided in [Q11](../08-project/open-questions.md#q11)). Where it isn't supported, the mic button is hidden, not disabled. That includes Firefox, and iOS before 14.5.
- **Disclosure ([Q20](../08-project/open-questions.md#q20)):** in Chrome, the audio is sent to the browser vendor's speech service. The first time the mic is used, a one-time notice shows (`note.mic_notice`) with Continue / Cancel. This keeps [NF-9](../05-quality/nfr.md#nf-9) honest.
- **While listening:**
  - The mic button becomes Stop, and `note.listening` is announced.
  - Interim words show in muted text at the cursor. Final words are inserted at the cursor, never replacing existing text.
  - Make tasks is disabled.
- **Stopping:** Stop, 8 s of silence, or 60 s total. Then `note.heard` shows above the text, and the cursor goes to the end of the inserted text.
- **Errors:**
  - Permission denied → `note.mic_denied`, and the mic stays visible so the user can retry.
  - No speech → `note.no_speech`.
  - Network error → `note.dictation_failed`.
- **Offline:** the mic is disabled with `note.dictation_offline` (Chrome's engine needs the network).

### 2.4 File to note (NC-4, Should)

- **Picker:** the paperclip opens the file picker with `accept` set to `.txt,.md,.csv,.pdf,.docx,.jpg,.jpeg,.png,.heic,.webp`. One file per note.
- **Client checks, before uploading:**
  - Size ≤ 5 MB, else `note.file_too_big`
  - Extension on the list, else `note.file_type`
- **Upload:** `POST /files/extract` (multipart). `note.reading_file` shows with a Cancel link, and the request is aborted on Cancel.
- **Server:** the [NF-17](../05-quality/nfr.md#nf-17) pipeline. Typed errors: `note.file_type` (magic bytes don't match), `note.file_locked`, `note.file_no_text`, `note.file_failed` (timeout or parser error).
- **On success:**
  - The text is appended at the end, separated by a blank line if the editor already had text.
  - A chip with the file name and a remove (×) button appears above the text.
  - The cursor moves to the start of the inserted text, so the user checks it.
- **Too much text:** if extracted text would push the note over 5,000 characters, only what fits is inserted, with `note.file_truncated`.
- **Removing the chip:**
  - If the inserted block is unchanged, it is removed too.
  - If it was edited, a dialog asks `note.file_remove_title` with Remove text / Keep text. Keep text drops only the "From" attribution.
- **Offline:** the paperclip is disabled with `note.file_offline`.
- **Where the text comes from ([Q12](../08-project/open-questions.md#q12)):**
  - Text, Markdown, CSV, Word, and PDFs with a text layer are read on the server, in the sandbox. Nothing leaves the server.
  - Photos and PDFs without a text layer go to **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`, language hints `en` and `vi`), sent inline and never through Cloud Storage. Only the first 5 pages of a scanned PDF are read (the synchronous API's limit), and `note.file_truncated` says so.
  - EXIF is stripped before sending, except orientation ([NF-17](../05-quality/nfr.md#nf-17)).
  - The Vision call shares the 10 s timeout. A Vision error or timeout returns `note.file_failed`.

### 2.5 New task sheet (NC-7)

- **Fields:**
  - Title (required, 1–200 characters, trimmed). Helper text `task.title_only`.
  - Due chips: Today, Tomorrow, Next week (Monday of next week, as [NU-E10](NU-note-understanding.md#nu-e10)), No date, Pick date… (native `<input type="date">`).
  - Priority chips: Low, Medium, High.
  - Project picker: No project, the user's projects, New project….
- **Defaults depend on where the sheet opened ([Q20](../08-project/open-questions.md#q20)):**

| Opened from | Due | Project |
|---|---|---|
| Inbox | Today | — |
| Upcoming | Tomorrow | — |
| A project | No date | That project |
| Anywhere else | No date | — |

- **Default priority** follows the NU rule: Medium when due today, otherwise Low. It follows changes to the due chip until the user taps a priority.
- **Add:**
  - Enabled when the title has visible text. Enter or Ctrl/Cmd+Enter submits.
  - The sheet closes, the task appears in the list at once ([UX-01](../01-product/ux-standards.md#ux-01)), and the toast `task.added` shows.
  - The task gets a client-generated UUID ([TK §7](TK-tasks.md#7-api-contract)), so it works offline.
- **New project…** opens the project sheet (PJ). On create, it comes back with that project selected.
- **Closing with input** asks `common.discard` ([UX-13](../01-product/ux-standards.md#ux-13)).

## 3. State matrix

| Component | Empty | Busy | Success | Error | Offline | Permission denied |
|---|---|---|---|---|---|---|
| Capture bar | Placeholder `note.placeholder` | — | — | — | Same (still opens the editor) | Mic hidden if unsupported |
| Editor | Examples, Make tasks disabled | `note.reading` after 300 ms, read-only | → RV screen, draft cleared | `422`: inline error under the text. `5xx` / network: queued, `note.processing_failed` | `note.save_offline`, paperclip and mic disabled | — |
| Dictation | — | `note.listening` with Stop | `note.heard` | `note.no_speech`, `note.dictation_failed` | Disabled, `note.dictation_offline` | `note.mic_denied` |
| File | — | `note.reading_file` with Cancel | Chip plus text | Typed file errors (§2.4) | Disabled, `note.file_offline` | — |
| New task sheet | Add disabled | Busy button ([UX-06](../01-product/ux-standards.md#ux-06)) | Toast `task.added` | `422`: field error. `task.limit` | Works. The task syncs later | — |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| <a id="nc-e1"></a>NC-E1 | The app is closed mid-note (tab killed, phone locked) | The draft from the last 500 ms debounce or `pagehide` is restored next time | T-NC-101, OFF-01 |
| <a id="nc-e2"></a>NC-E2 | A paste pushes the note over 5,000 characters | Kept in full. Red counter, Make tasks disabled until trimmed | T-NC-102 |
| <a id="nc-e3"></a>NC-E3 | Microphone permission denied | `note.mic_denied`. The mic stays, so a retry re-asks or explains | T-NC-103 |
| <a id="nc-e4"></a>NC-E4 | The browser doesn't support speech recognition | The mic is hidden, in the editor and on the capture bar | T-NC-104 |
| <a id="nc-e5"></a>NC-E5 | Scanned PDF with no text layer | Its first 5 pages go to Google Cloud Vision ([Q12](../08-project/open-questions.md#q12)). Still nothing → `note.file_no_text` | T-NC-105 |
| <a id="nc-e6"></a>NC-E6 | Password-protected PDF | `note.file_locked` | T-NC-106, SEC-32 |
| <a id="nc-e7"></a>NC-E7 | Renamed file (an `.exe` saved as `.pdf`) | Magic bytes don't match → `note.file_type` | T-NC-107, SEC-30 |
| <a id="nc-e8"></a>NC-E8 | HEIC photo from an iPhone | Accepted. Converted to JPEG inside the sandbox, then sent to Google Cloud Vision | T-NC-108 |
| <a id="nc-e9"></a>NC-E9 | Extracted text over the space left | Inserted up to 5,000 characters in total, with `note.file_truncated` | T-NC-109 |
| <a id="nc-e10"></a>NC-E10 | Double tap on Make tasks | The busy button ignores it. A retry carries the same `client_id`, so there is only one note | T-NC-110, SEC-13 |
| <a id="nc-e11"></a>NC-E11 | Connection drops after the request was sent, before the reply | Queued with the same `client_id`. The replay returns the stored result (`200`). No duplicate | T-NC-111, OFF-02 |
| <a id="nc-e12"></a>NC-E12 | Device storage full while offline | Save note fails, the text stays in the editor, and `app.storage_low` shows | T-NC-112 |
| <a id="nc-e13"></a>NC-E13 | Signed out while notes are pending | The sign-out dialog counts them as unsaved changes (AA). Confirming deletes them | T-NC-113 |
| <a id="nc-e14"></a>NC-E14 | The time zone changes between writing offline and syncing | `written_at` and `timezone` are from writing time ([NU-E26](NU-note-understanding.md#nu-e26)) | T-NC-114 |
| <a id="nc-e15"></a>NC-E15 | New task with only spaces as the title | Add stays disabled. The server returns `422` too | T-NC-115 |
| <a id="nc-e16"></a>NC-E16 | Pick date… cancelled | The previous due chip stays selected | T-NC-116 |
| <a id="nc-e17"></a>NC-E17 | Dictating while the text has a selection | The selection is replaced by the dictated words, as typing would | T-NC-117 |

## 5. Copy keys

`note.placeholder`, `note.make_tasks`, `note.save_offline`, `note.saved_offline`, `note.reading`, `note.too_long`, `note.draft_restored`, `note.discard_title`, `note.discard_body`, `common.discard_action`, `common.keep_editing`, `note.listening`, `note.stop`, `note.heard`, `note.mic_notice`, `note.mic_denied`, `note.no_speech`, `note.dictation_failed`, `note.dictation_offline`, `note.reading_file`, `note.file_too_big`, `note.file_type`, `note.file_locked`, `note.file_no_text`, `note.file_failed`, `note.file_truncated`, `note.file_remove_title`, `note.file_offline`, `note.waiting`, `note.back_online_one`, `note.back_online_other`, `task.new`, `task.title_only`, `task.added`, `task.limit`, `common.discard`, `app.storage_low`.

## 6. Accessibility

- The text area has the label "Note". Its placeholder isn't its only label. A11Y-30
- The mic button's accessible name changes: "Dictate" → "Stop dictating". Its state is announced ([UX-60](../01-product/ux-standards.md#ux-60)). A11Y-31
- The counter is linked with `aria-describedby`. It's announced politely once, at 4,500 and at 5,000. A11Y-32
- The file chip's remove button is labelled "Remove {file name}". A11Y-33
- Due and priority chips are radio groups with labels. The sheet's focus is trapped ([UX-10](../01-product/ux-standards.md#ux-10)), and focus returns to `+` on close ([UX-11](../01-product/ux-standards.md#ux-11)). A11Y-34

## 7. API contract

- `POST /notes`: [NU module §7](NU-note-understanding.md#7-api-contract).
- `POST /files/extract` (multipart `file`):

| Status | Body |
|---|---|
| `200` | `{text, truncated: bool, file_name}`. `text` is at most 5,000 characters |
| `413` | `note.file_too_big` |
| `415` | `note.file_type` |
| `422` | `note.file_locked`, `note.file_no_text` |
| `504` | `note.file_failed` (the 10 s sandbox timeout) |
| `429` | `error.rate_limited` (10/hour, 30/day) |

- `POST /tasks`: [TK module §7](TK-tasks.md#7-api-contract).

## 8. Data, validation and authorization

- **On the device:** drafts and pending notes live in IndexedDB, keyed by user ID. They are wiped on sign-out ([NF-19](../05-quality/nfr.md#nf-19)).
- **Files:**
  - Streamed to a temporary file, given to the sandboxed worker, and deleted in a `finally` step ([SC-16](../07-architecture/security.md#sc-16)).
  - Never stored or logged.
  - `file_name` is reduced to its base name.
- **Authorization:** both endpoints need a session. There are no resource IDs, so IDOR doesn't apply.

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Malicious file (parser exploit, zip or XML bomb, polyglot) | [SC-15](../07-architecture/security.md#sc-15) magic bytes, sandbox, 10 s and 50 MB caps | SEC-30–33 |
| Using extraction as free OCR at scale (Google Cloud Vision is billed per image) | 10/hour, 30/day per user. A monthly Vision quota set in Google Cloud | SEC-10 |
| Files kept with personal data | [SC-16](../07-architecture/security.md#sc-16) deleted in `finally` | SEC-34 |
| A draft left on a shared device | Wiped on sign-out ([SC-19](../07-architecture/security.md#sc-19)) | SEC-50 |

## 10. Performance and scaling

- The editor opens in ≤ 100 ms (no network on open). The editor's code is in the app shell.
- File extraction runs on a queue worker, while the request waits for the result for up to 10 s. One queue worker on the server is enough (30/day cap × 5k users is the theoretical maximum. The real expectation is under 500/day).
- Load: PERF-02 (notes), PERF-04 (replay).

## 11. Acceptance criteria → tests

| Req | Acceptance criterion | Tests |
|---|---|---|
| [NC-1](#nc-1) | The capture bar and the Notes tab open a full-screen editor with the cursor in the text | T-NC-01 (E2E, both entries, focus asserted), T-NC-02 (iOS WebKit keyboard focus) |
| [NC-1](#nc-1) | Examples show while the text is empty | T-NC-03 |
| [NC-2](#nc-2) | No fields are required. Make tasks is enabled as soon as there is text | T-NC-04, T-NC-115 |
| [NC-3](#nc-3) | "Listening…" with Stop. The text lands in the editor with "Here's what I heard." Make tasks disabled while listening | T-NC-10 (component with a mocked SpeechRecognition), T-NC-11, T-NC-12 |
| [NC-4](#nc-4) | Accepts the listed types up to 5 MB, and the text lands in the editor to check | T-NC-20 (one per type), T-NC-21 |
| [NC-4](#nc-4) | A removable file chip | T-NC-22 (unchanged → text removed), T-NC-23 (edited → dialog) |
| [NC-4](#nc-4) | Unsupported or oversized files get a specific error | T-NC-24 (client checks), T-NC-25 (server codes) |
| [NC-4](#nc-4) | The result shows "From \<file name>" | T-RV-01 (RV) |
| [NC-5](#nc-5) | Tapping an example chip fills the editor | T-NC-30 |
| [NC-6](#nc-6) | The button reads Save note. Stored on the device as "Waiting for connection" | T-NC-40, OFF-03 |
| [NC-6](#nc-6) | Processed on reconnect with the toast "Back online. N notes turned into M tasks." | OFF-04 (Playwright `setOffline`), T-NC-41 (toast counts, singular and plural) |
| [NC-7](#nc-7) | `+` opens New task. Only a title is required | T-NC-50 |
| [NC-7](#nc-7) | Due chips Today, Tomorrow, Next week, No date, Pick date…, priority, project | T-NC-51 (dates computed with an injected clock), T-NC-52 (defaults by entry) |
| [NC-7](#nc-7) | The toast confirms "Added “…”" | T-NC-53 |
| — | Edge cases [NC-E1](#nc-e1)–[NC-E17](#nc-e17) | T-NC-101–117 |
| — | Accessibility | A11Y-30–34 |
