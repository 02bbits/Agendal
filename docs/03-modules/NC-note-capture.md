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
| <a id="nc-1"></a>NC-1 | Open the note editor in one tap from any list screen | Must | The capture bar and the Notes tab open the editor with the cursor in the text |
| <a id="nc-2"></a>NC-2 | Write a free-text note containing several tasks | Must | No fields are required; Make tasks is enabled as soon as there is text |
| <a id="nc-3"></a>NC-3 | Dictate a note | Should | Dictate a note in the note's tray opens the dictation sheet over the note: "Listening…" with Stop; the words heard go into the note at the cursor, to check before Make tasks |
| <a id="nc-4"></a>NC-4 | Turn a file into a note | Should | Accepts text, Markdown, CSV, PDF, Word and photos up to 5 MB; extracted text lands in the editor to check; a removable file chip shows; unsupported or oversized files get a specific error; the result shows "From \<file name>" |
| <a id="nc-5"></a>NC-5 | Start from an example | Could | Dropped in #166: the editor shows no examples |
| <a id="nc-6"></a>NC-6 | Capture while offline | Must | The button reads Save note; the note is stored on the device as "Waiting for connection"; on reconnect it is processed automatically with a toast "Back online. N notes turned into M tasks." |
| <a id="nc-7"></a>NC-7 | Add a task by hand | Must | The + button opens New task: only a title is required; start date chips Today, Tomorrow, Next week, No date, Custom; an optional due date; repeat; priority; project; a toast confirms "Added “…”" |

## 1. Entry points and user stories

| Entry | Opens |
|---|---|
| Capture bar "Write a note…" (every list screen) | Editor, cursor in the text |
| Notes tab, Write a note (empty state) | Editor |
| `+` button (every list screen) | New task sheet |

- As a user with a spare minute, I tap once and type, so that capture takes seconds.
- As a user walking, I dictate instead of typing.
- As a group member, I attach meeting notes, so that each action item becomes a task.
- As a user on a train with no signal, I still save notes.
- As a planner, I add one task by hand with only a title.

## 2. Behaviour detail

### 2.1 Editor (NC-1, NC-2, NC-5)

- **Layout:** a drawer that slides up from the capture bar, as tall as the note and its tray (so nothing scrolls and the side margins stay even; it scrolls, with no visible scrollbar, only on a screen too short for it), over the content column, up to 712px wide from 768px; the screen is dimmed behind and a tap on it closes like Cancel. On a phone a grabber sets how far it is open (up to just under the top), and letting it go below a quarter of the screen closes it like Cancel; from 768px there is no grabber and the height is fixed. Cancel on the left and "✦ New note" in the centre; under them the time ("Today 15:35", in the account's clock: for a new note the time now, kept up to date while it is open; for a saved one when it was written), then a line; the note starts under the line; the "Your note" card (429px minimum, text on ruled lines that move with the text: the card grows and the drawer scrolls, keeping the last line of text in view); under it one place, kept two lines tall so the drawer doesn't jump, for the counter, `note.reading` / `note.reading_file` and errors; then a bottom bar with a round arrow beside Make tasks, every button 44px tall. The arrow (it turns to point down while open) opens a tray with Dictate a note (§2.3) and Upload file (§2.4); the tray slides open and shut, so quick taps reverse it smoothly instead of jumping. The note takes at most 50 lines: Enter stops there and a paste keeps the first 50 ([NF-14](../05-quality/nfr.md#nf-14)). Every row keeps the same side margins (20px, 40px from 768px). The bar sits above the keyboard ([UX-20](../01-product/ux-standards.md#ux-20)).
- **Focus:** the text area is focused inside the tap handler, so iOS opens the keyboard (focusing after an `await` doesn't).
- **Examples:** none ([NC-5](#nc-5) dropped in #166).
- **Make tasks** is enabled when the text has a visible character ([NU-E15](NU-note-understanding.md#nu-e15)), and not while listening or reading a file. Ctrl/Cmd+Enter submits ([UX-12](../01-product/ux-standards.md#ux-12)).
- **Counter:** hidden below 4,500 characters. From 4,500 it shows `4,612 / 5,000`. The note stops at 5,000: nothing more can be typed, pasted or dictated ([NF-14](../05-quality/nfr.md#nf-14)).
- **Paste:** the text area is plain text, so formatting is dropped by the platform. A paste that would cross 5,000 characters keeps only what fits.
- **Draft ([UX-13](../01-product/ux-standards.md#ux-13)):**
  - The text is saved to IndexedDB 500 ms after the last keystroke, and on `pagehide` / `visibilitychange`.
  - A browser aborts an IndexedDB write still running as the page unloads, so on `pagehide` / `visibilitychange` the text is also copied to `localStorage`, which writes at once. The next open moves that copy back to IndexedDB and removes it ([NC-E1](#nc-e1)).
  - Opening the editor restores it with `note.draft_restored`.
  - A successful submit clears it.
  - One draft per user per device. It is wiped on sign-out ([NF-19](../05-quality/nfr.md#nf-19)).
- **Close:** an empty editor closes at once. With text, Cancel, Escape and Back ask `note.discard_title` with *Discard* and *Keep editing*. Discard clears the draft and closes; Keep editing returns to the text. The draft is for when the app closes mid-note ([NC-E1](#nc-e1)).

### 2.2 Submit

- **Online:**
  - The client generates `client_id` (UUID v4) and `written_at` (with offset), and reads `timezone` from `Intl`.
  - It posts to `POST /notes`, shows `note.reading` after 300 ms (with a small progress mark: a ring whose arc turns), then closes the editor and opens the RV screen. From 1280px it opens as the Notes popup (or side panel, by Page view) over the screen the note was written on, which stays as it was: closing or applying returns there. Narrower, it is the note's page, and Back returns to that screen.
  - A network error or `5xx` queues the note ([NU §3](NU-note-understanding.md#3-state-matrix)).
  - `client_id` is made when the editor opens and kept for retries ([NC-E10](#nc-e10), [NC-E11](#nc-e11)). Changing the text after a failed send gives the next try a new `client_id`, because the server answers a known id with its stored result and ignores the body ([ADR-003](../07-architecture/decisions/ADR-003-offline-note-queue-and-idempotency.md)).
  - A network error or `5xx` keeps the note on the device under the same `client_id` (status `pending`), closes the editor and shows `note.processing_failed`; it is sent again on the next sync ([IM-53](../08-project/tasks.md#im-53)). `422` shows its inline error and keeps the text. `429` shows `error.rate_limited` with a countdown from `Retry-After`, and Make tasks stays off until it ends.
- **Offline:**
  - The button reads `note.save_offline`.
  - The note is written to IndexedDB with the same fields and status `pending`.
  - The editor closes with the toast `note.saved_offline`.
  - The Notes tab shows the card with `note.waiting` ([NC-6](#nc-6)). It has no result to open, so the card is not a link until the note is processed.
- **Storage write fails** (quota or private mode): the text stays in the editor with `app.storage_low`. Nothing is lost.
- **Replay:** on reconnect, after the queued task edits and oldest first ([ADR-003](../07-architecture/decisions/ADR-003-offline-note-queue-and-idempotency.md), [ADR-005](../07-architecture/decisions/ADR-005-sync-protocol.md)), then one toast `note.back_online_*` (plus `note.needs_look_*`). N is the notes sent, M the tasks those notes plan to create (applied or not, because with `NOTE_CHANGES_TO_CONFIRM` at 1 most notes wait for Apply), and the needs-a-look count the notes that ended `confirm` or `followup`. A note the server refuses (`4xx` except `429`) is not sent again: its card shows `note.couldnt_process` (the text stays on the device), and a tap puts the text back in the editor as the unsent draft, ahead of any other draft, and removes the card. A `429` or `5xx` stops the replay and the rest wait, in order.

### 2.3 Dictation (NC-3, Should)

- **Engine ([Q11](../08-project/open-questions.md#q11)):** the device records the audio and the server has the app's language model ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)) write it down word for word, in the languages spoken: a note often mixes Vietnamese and English. The browser's own speech service is not used: it is unreliable on iPhone and missing in Firefox. Where the browser can't record audio, the mic button is hidden, not disabled.
- **Recording:** 16 kHz mono WAV, made on the device and sent inline to `POST /notes/dictation`. A recording with less than 300 ms of loud sound (a click, a cough) is not sent and ends with `note.no_speech`. The audio is never stored or logged.
- **Writing down:** the model first says whether it heard clear speech, so silence or noise gives no words instead of made-up ones. It writes what was said as a note would be typed: English words inside Vietnamese speech stay in English (call mum, ROI), numbers and times are digits ("5 giờ chiều", "9am"), and a comma goes only between tasks, since the rules split on it ([NU §2.2](NU-note-understanding.md)).
- **Dictation sheet:** Dictate a note in the note's tray opens it over the note (the capture bar has no mic). When the note already has text it first asks `note.replace_title`: Add puts the words at the cursor, Replace makes them the whole note. Recording starts at once in that tap (iOS only starts audio inside a tap). It is a drawer that slides up inside the note, over its lower part, with the note dimmed behind it; its grabber works as the note's does (on a phone only; from 768px its height is fixed). It has no header: a round × beside the main button drops the recording (nothing is sent), as do Escape, Back and a tap on the dimmed note.
- **Disclosure ([Q20](../08-project/open-questions.md#q20)):** the recording goes to the app's language model. The first time the mic is used on a device, the sheet first shows `note.mic_notice`, with × and Continue under it; Continue starts the recording. This keeps [NF-9](../05-quality/nfr.md#nf-9) honest.
- **While listening:** a red dot with `note.listening` and the time (0:04), a waveform that follows the voice (`accent`), × beside a round red Stop, and under them `note.dictation_hint` as a small note (overline size, `ink3`). `note.listening` is announced.
- **Stopping:** Stop, 8 s of silence, or 2 minutes total. `note.reading` shows under the waveform while the model writes the words down (a few seconds). The words show then, not while speaking.
- **The words heard:** the sheet closes and the words go into the note at the cursor (a selection is replaced, [NC-E17](#nc-e17)), with a space either side where needed, and only as many as fit in the note's 5,000 characters; the cursor goes to their end. There is no live transcript: the user checks and changes the words in the note, then taps Make tasks.
- **Errors:**
  - Permission denied → `note.mic_denied`, and the sheet's mic stays so the user can retry.
  - No speech → `note.no_speech`.
  - The dictation limit (`429`) → `error.rate_limited` with the seconds to wait from `retry_after`, as for Make tasks.
  - Network error, the model off or failing → `note.dictation_failed`.
- **Offline:** the sheet shows `note.dictation_offline` and its mic is disabled (the model is on the server).

### 2.4 File to note (NC-4, Should)

- **Picker:** Upload file in the note's tray opens the file picker with `accept` set to `.txt,.md,.csv,.pdf,.docx,.jpg,.jpeg,.png,.webp` (HEIC is not read yet: it needs a converter in the sandbox, NC-E8). A file can also be dragged onto the open note: the paper shows a dashed outline while it is over the note, and the drop uploads it the same way (the browser never opens it over the note). One file per note: Upload file is off, and a drop is ignored, while a file is attached; offline a drop shows `note.file_offline`.
- **Client checks, before uploading:**
  - Size ≤ 5 MB, else `note.file_too_big`
  - Extension on the list, else `note.file_type`
- **Upload:** `POST /notes/extract` (multipart). `note.reading_file` shows (with the progress mark), and Make tasks becomes Cancel, which aborts the request.
- **A note that already has text:** Upload file and a dropped file first ask `note.replace_title` with Add (the file's text goes at the end, as below) and Replace (it takes the note's place).
- **Server:** the [NF-17](../05-quality/nfr.md#nf-17) pipeline. Typed errors: `note.file_type` (magic bytes don't match), `note.file_locked`, `note.file_no_text`, `note.file_failed` (timeout or parser error).
- **On success:**
  - The text is appended at the end, separated by a blank line if the editor already had text.
  - A card above the note shows a tile for the file's type (a picture for a photo; otherwise its extension, PDF in red, DOCX in blue, CSV in green, MD in amber, TXT in grey), the file name, its size and, for a PDF, its pages ("234 KB · 2 pages"), with a remove (×) button. The note's label reads `note.text_label_from`.
  - The cursor moves to the start of the inserted text, so the user checks it.
- **Too much text:** if the file's text would push the note over 5,000 characters, nothing is added and `note.file_too_long` shows. The server refuses a file with more than 5,000 characters of text the same way. `note.file_truncated` is only for a scanned PDF of more than 5 pages, of which the first 5 are read.
- **Removing the chip:**
  - If the inserted block is unchanged, it is removed too.
  - If it was edited, a dialog asks `note.file_remove_title` with Remove text / Keep text. Keep text drops only the "From" attribution.
- **Offline:** the paperclip is disabled with `note.file_offline`.
- **Where the text comes from ([Q12](../08-project/open-questions.md#q12)):**
  - Text, Markdown, CSV, Word, and PDFs with a text layer are read on the server, in the sandbox. Nothing leaves the server.
  - Photos and PDFs without a text layer go to **the app's language model (Gemini)** with the same key, model and kill switch as the fallback ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)), sent inline and not kept. The prompt (`note-ocr-v1`) asks first whether there is any writing, then for the words exactly as written, in their language, untranslated; no writing → `note.file_no_text`. With the model off (or a provider other than Gemini), these files answer `note.file_failed` and every other file still works. Only the first 5 pages of a scanned PDF are read, and `note.file_truncated` says so.
  - EXIF is stripped before sending, except orientation ([NF-17](../05-quality/nfr.md#nf-17)). Not built yet: the API image has no image library, so photos go to the model as they are.
  - Each try waits up to 15 s (`NOTE_OCR_TIMEOUT_SECONDS`) and a stalled or busy try is made once more (`NOTE_OCR_ATTEMPTS`). An error or timeout returns `note.file_failed`.

### 2.5 New task sheet (NC-7)

- **Fields:**
  - Title (required, 1–200 characters, trimmed).
  - Start date chips: Today, Tomorrow, Next week (Monday of next week, as [NU-E10](NU-note-understanding.md#nu-e10)), No date, Custom (native `<input type="date">`). The date a task is created with is its start date (#154). Start time, enabled once there is a start date.
  - Due date (optional) with a due time, empty by default. It must be on or after the start, date and time ([BR-11](../02-domain/business-rules.md#br-11)).
  - Repeat: the presets and Custom… of [TK §2.2](TK-tasks.md#22-task-details-and-editing-tk-2-tk-3). Choosing a repeat with No date sets the start date to Today. Reminders are set in task details, not here.
  - Priority chips: Low, Medium, High.
  - Project picker: No project, the user's projects, New project…. New project opens over the sheet and comes back with the project selected.
- **Defaults depend on where the sheet opened ([Q20](../08-project/open-questions.md#q20)):**

| Opened from | Start date | Project |
|---|---|---|
| Inbox | Today | — |
| Upcoming | Tomorrow | — |
| A project | No date | That project |
| Anywhere else | No date | — |

- The **+** on a day in Upcoming opens with that day as the start date.
- **Default priority:** Medium when the task starts today, otherwise Low. It follows changes to the start date chip until the user taps a priority.
- **Add:**
  - Enabled when the title has visible text. Enter or Ctrl/Cmd+Enter submits.
  - The sheet closes, the task appears in the list at once ([UX-01](../01-product/ux-standards.md#ux-01)), and the toast `task.added` shows.
  - The task gets a client-generated UUID ([TK §7](TK-tasks.md#7-api-contract)), so it works offline.
- **New project…** opens the project sheet (PJ). On create, it comes back with that project selected.
- **Closing with input** asks `common.discard` ([UX-13](../01-product/ux-standards.md#ux-13)).

## 3. State matrix

| Component | Empty | Busy | Success | Error | Offline | Permission denied |
|---|---|---|---|---|---|---|
| Capture bar | Placeholder `note.placeholder` | — | — | — | Same (still opens the editor) | — |
| Editor | Make tasks disabled | `note.reading` after 300 ms, read-only | → RV screen, draft cleared | `422`: inline error under the text. `5xx` / network: queued, `note.processing_failed` | `note.save_offline`, paperclip disabled | — |
| Dictation sheet | First use: `note.mic_notice` | `note.listening` with Stop, then `note.reading` | Closes; the words are in the note | `note.no_speech`, `note.dictation_failed`, `error.rate_limited` | Mic disabled, `note.dictation_offline` | `note.mic_denied` |
| File | — | `note.reading_file` with Cancel | Chip plus text | Typed file errors (§2.4) | Disabled, `note.file_offline` | — |
| New task sheet | Add disabled | Busy button ([UX-06](../01-product/ux-standards.md#ux-06)) | Toast `task.added` | `422`: field error. `task.limit` | Works. The task syncs later | — |

## 4. Edge cases

| ID | Situation | Decision | Test |
|---|---|---|---|
| <a id="nc-e1"></a>NC-E1 | The app is closed mid-note (tab killed, phone locked) | The draft from the last 500 ms debounce or `pagehide` is restored next time | T-NC-101, OFF-01 |
| <a id="nc-e2"></a>NC-E2 | A paste would push the note over 5,000 characters | Only what fits is pasted; the note stops at 5,000 | T-NC-102 |
| <a id="nc-e3"></a>NC-E3 | Microphone permission denied | `note.mic_denied`. The mic stays, so a retry re-asks or explains | T-NC-103 |
| <a id="nc-e4"></a>NC-E4 | The browser can't record audio (no `getUserMedia` or Web Audio) | Dictate a note is hidden from the tray | T-NC-104 |
| <a id="nc-e5"></a>NC-E5 | Scanned PDF with no text layer | Its first 5 pages go to the language model ([Q12](../08-project/open-questions.md#q12)). Still nothing → `note.file_no_text` | T-NC-105 |
| <a id="nc-e6"></a>NC-E6 | Password-protected PDF | `note.file_locked` | T-NC-106, SEC-32 |
| <a id="nc-e7"></a>NC-E7 | Renamed file (an `.exe` saved as `.pdf`) | Magic bytes don't match → `note.file_type` | T-NC-107, SEC-30 |
| <a id="nc-e8"></a>NC-E8 | HEIC photo from an iPhone | Accepted. Converted to JPEG inside the sandbox, then sent to the language model | T-NC-108 |
| <a id="nc-e9"></a>NC-E9 | Extracted text over the space left | Nothing is added; `note.file_too_long` | T-NC-109 |
| <a id="nc-e10"></a>NC-E10 | Double tap on Make tasks | The busy button ignores it. A retry carries the same `client_id`, so there is only one note | T-NC-110, SEC-13 |
| <a id="nc-e11"></a>NC-E11 | Connection drops after the request was sent, before the reply | Queued with the same `client_id`. The replay returns the stored result (`200`). No duplicate | T-NC-111, OFF-02 |
| <a id="nc-e12"></a>NC-E12 | Device storage full while offline | Save note fails, the text stays in the editor, and `app.storage_low` shows | T-NC-112 |
| <a id="nc-e13"></a>NC-E13 | Signed out while notes are pending | The sign-out dialog counts them as unsaved changes (AA). Confirming deletes them | T-NC-113 |
| <a id="nc-e14"></a>NC-E14 | The time zone changes between writing offline and syncing | `written_at` and `timezone` are from writing time ([NU-E26](NU-note-understanding.md#nu-e26)) | T-NC-114 |
| <a id="nc-e15"></a>NC-E15 | New task with only spaces as the title | Add stays disabled. The server returns `422` too | T-NC-115 |
| <a id="nc-e16"></a>NC-E16 | Custom cancelled | The previous start date chip stays selected | T-NC-116 |
| <a id="nc-e17"></a>NC-E17 | Dictating while the text has a selection | The selection is replaced by the dictated words, as typing would | T-NC-117 |

## 5. Copy keys

`note.placeholder`, `note.make_tasks`, `note.save_offline`, `note.saved_offline`, `note.reading`, `note.too_long`, `note.draft_restored`, `note.discard_title`, `note.discard_body`, `common.discard_action`, `common.keep_editing`, `note.listening`, `note.stop`, `note.heard`, `note.mic_notice`, `note.dictation_hint`, `note.tools`, `note.mic_denied`, `note.text_label_from`, `note.file_keep_text`, `note.file_remove_text`, `note.no_speech`, `note.dictation_failed`, `note.dictation_offline`, `note.reading_file`, `note.file_too_big`, `note.file_type`, `note.file_locked`, `note.file_no_text`, `note.file_failed`, `note.file_truncated`, `note.file_remove_title`, `note.file_offline`, `note.waiting`, `note.back_online_one`, `note.back_online_other`, `task.new`, `task.added`, `task.limit`, `common.discard`, `app.storage_low`.

## 6. Accessibility

- The text area has the label "Note". Its placeholder isn't its only label. A11Y-30
- The mic is labelled "Dictate a note" (`note.mic`), and the note's ^ is labelled `note.tools` and says whether its tray is open. In the dictation sheet Stop is labelled `note.stop`, and the listening time sits in a status line. Its state is announced ([UX-60](../01-product/ux-standards.md#ux-60)). A11Y-31
- The counter is linked with `aria-describedby`. It's announced politely once, at 4,500 and at 5,000. A11Y-32
- The file chip's remove button is labelled "Remove {file name}". A11Y-33
- Due and priority chips are radio groups with labels. The sheet's focus is trapped ([UX-10](../01-product/ux-standards.md#ux-10)), and focus returns to `+` on close ([UX-11](../01-product/ux-standards.md#ux-11)). A11Y-34

## 7. API contract

- `POST /notes`: [NU module §7](NU-note-understanding.md#7-api-contract).
- `POST /notes/extract` (multipart `file`):

| Status | Body |
|---|---|
| `200` | `{text, truncated: bool, file_name, pages}`. `text` is at most 5,000 characters; `pages` is a PDF's page count, else null |
| `413` | `note.file_too_big` |
| `415` | `note.file_type` |
| `422` | `note.file_locked`, `note.file_no_text`, `note.file_too_long` (more than 5,000 characters of text) |
| `504` | `note.file_failed` (the 10 s sandbox timeout) |
| `429` | `error.rate_limited` (10/hour, 30/day) |

- `POST /notes/dictation` (multipart `audio`, WAV, ≤ 4 MB):

| Status | Body |
|---|---|
| `200` | `{text}`. Empty when no speech was heard |
| `422` | `error.invalid` (no audio, not WAV, or too large) |
| `502` · `503` | `note.dictation_failed` (the model failed or is off, or both tries stalled; a try waits 8 s plus 2 s per 30 s of audio, so the user waits about 17 s at most for a short note and 33 s for 2 minutes) |
| `429` | `error.rate_limited` (10/minute, 100/day) |

- `POST /tasks`: [TK module §7](TK-tasks.md#7-api-contract).

## 8. Data, validation and authorization

- **On the device:** drafts and pending notes live in IndexedDB, keyed by user ID. The only exception is the draft's copy in `localStorage`, from when the page is hidden until it next opens (§2.1). All of them are wiped on sign-out ([NF-19](../05-quality/nfr.md#nf-19)).
- **Files:**
  - Streamed to a temporary file, given to the sandboxed worker, and deleted in a `finally` step ([SC-16](../07-architecture/security.md#sc-16)).
  - Never stored or logged.
  - `file_name` is reduced to its base name.
- **Dictation audio:** read in memory, sent to the model and dropped. Never stored or logged.
- **Authorization:** all three endpoints need a session. There are no resource IDs, so IDOR doesn't apply.

## 9. Abuse cases

| Abuse | Control | Test |
|---|---|---|
| Malicious file (parser exploit, zip or XML bomb, polyglot) | [SC-15](../07-architecture/security.md#sc-15) magic bytes, sandbox, 10 s and 50 MB caps | SEC-30–33 |
| Using extraction as free OCR at scale (each photo or scan is a paid model call) | 10/hour, 30/day per user. The calls count against the LLM key's own limits ([ADR-008](../07-architecture/decisions/ADR-008-llm-fallback.md)) | SEC-10 |
| Using dictation as free speech-to-text at scale (the model is billed per token) | 10/minute, 100/day per user; 2 minutes and 4 MB per recording | SEC-10 |
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
| [NC-1](#nc-1) | No examples (NC-5 dropped in #166) | T-NC-03 |
| [NC-2](#nc-2) | No fields are required. Make tasks is enabled as soon as there is text | T-NC-04, T-NC-115 |
| [NC-3](#nc-3) | The mic opens the dictation sheet over the note: "Listening…" with Stop; on Stop the words go into the note at the cursor | T-NC-10 (component with a mocked recorder and `POST /notes/dictation`), T-NC-11, T-NC-12 |
| [NC-4](#nc-4) | Accepts the listed types up to 5 MB, and the text lands in the editor to check | T-NC-20 (one per type), T-NC-21 |
| [NC-4](#nc-4) | A removable file chip | T-NC-22 (unchanged → text removed), T-NC-23 (edited → dialog) |
| [NC-4](#nc-4) | Unsupported or oversized files get a specific error | T-NC-24 (client checks), T-NC-25 (server codes) |
| [NC-4](#nc-4) | The result shows "From \<file name>" | T-RV-01 (RV) |
| [NC-5](#nc-5) | Dropped in #166 | T-NC-30 |
| [NC-6](#nc-6) | The button reads Save note. Stored on the device as "Waiting for connection" | T-NC-40, OFF-03 |
| [NC-6](#nc-6) | Processed on reconnect with the toast "Back online. N notes turned into M tasks." | OFF-04 (Playwright `setOffline`), T-NC-41 (toast counts, singular and plural) |
| [NC-7](#nc-7) | `+` opens New task. Only a title is required | T-NC-50 |
| [NC-7](#nc-7) | Start date chips Today, Tomorrow, Next week, No date, Custom, an optional due date, repeat, priority, project | T-NC-51 (dates computed with an injected clock), T-NC-52 (defaults by entry) |
| [NC-7](#nc-7) | The toast confirms "Added “…”" | T-NC-53 |
| — | Edge cases [NC-E1](#nc-e1)–[NC-E17](#nc-e17) | T-NC-101–117 |
| — | Accessibility | A11Y-30–34 |
