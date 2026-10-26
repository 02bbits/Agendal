# M02 Note Capture — Product Requirements

Priority: **Must** = needed for v1 · **Should** = v1 if time allows, otherwise v1.1 · **Could** = later.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| NC-1 | Open the note editor in one tap from any list screen | Must | The capture bar and the Notes tab open a full-screen editor with the cursor in the text; examples show while it is empty |
| NC-2 | Write a free-text note containing several tasks | Must | No fields are required; Make tasks is enabled as soon as there is text |
| NC-3 | Dictate a note | Should | The mic shows "Listening…" with Stop; the recognised text lands in the editor to check ("Here's what I heard."); Make tasks is disabled while listening |
| NC-4 | Turn a file into a note | Should | Accepts text, Markdown, CSV, PDF, Word and photos up to 5 MB; extracted text lands in the editor to check; a removable file chip shows; unsupported or oversized files get a specific error; the result shows "From \<file name>" |
| NC-5 | Start from an example | Could | Tapping an example chip fills the editor |
| NC-6 | Capture while offline | Must | The button reads Save note; the note is stored on the device as "Waiting for connection"; on reconnect it is processed automatically with a toast "Back online. N notes turned into M tasks." |
| NC-7 | Add a task by hand | Must | The + button opens New task: only a title is required; due chips Today, Tomorrow, Next week, No date, Pick date…; priority; project; a toast confirms "Added “…”" |
