# Copy Catalog

Every user-facing string, keyed. Code, specs and API error `code`s use these keys, never inline text. The UI is English only. Notes can be written in Vietnamese, but the UI isn't translated ([Q3](../08-project/open-questions.md#q3)). Voice: [theme guide](theme-guide.md#content-and-voice).

**Conventions:**
- `{name}` is a placeholder.
- Keys with a count have `_one` and `_other` forms ([UX-33](ux-standards.md#ux-33)).
- Task and project names inside text use curly quotes: “{title}”.
- Strings marked † are **new in the docs** (not in the PRD). Review them with the PRD owner.

## Common

| Key | Text | Where |
|---|---|---|
| `common.undo` | Undo | Toast action |
| `common.cancel` | Cancel | Dialogs, sheets |
| `common.not_now` | Not now | Install banner |
| `common.retry` † | Retry | Error toasts and banners |
| `common.done` | Done | Note result |
| `common.discard` † | Discard changes? | Closing a sheet with edits. Buttons: Discard / Keep editing |
| `common.discard_action` † | Discard | Button in the "Discard this note?" dialog |
| `common.keep_editing` † | Keep editing | Button in the same dialog |
| `common.back` | Back | Back button accessible name |

## Account and access (AA)

| Key | Text | Where |
|---|---|---|
| `auth.welcome` | Welcome to Agendal. Your account is ready. | Toast after sign-up ([AA-1](../03-modules/AA-account-access.md#aa-1)) |
| `auth.password_rule` | At least 8 characters, and not your email. | Helper under the password field |
| `auth.password_same_as_email` † | Your password can't be your email. | Field error |
| `auth.password_breached` † | This password has appeared in a data breach. Choose another one. | Field error (SEC-06) |
| `auth.email_taken` † | An account with this email already exists. Sign in instead? | Field error, links to Sign in |
| `auth.invalid` | Email or password is incorrect. | Sign-in error ([AA-2](../03-modules/AA-account-access.md#aa-2)) |
| `auth.locked_title` | Too many attempts | Banner title ([AA-3](../03-modules/AA-account-access.md#aa-3)) |
| `auth.locked_body` † | Try again in {seconds} s. | Banner body, live countdown |
| `auth.remember_me` | Remember me | Checkbox, on by default |
| `auth.reset_sent` † | If an account exists for {email}, we've sent a link to reset your password. It works for 60 minutes. | Same text either way ([AA-4](../03-modules/AA-account-access.md#aa-4)) |
| `auth.reset_resend` † | Resend link | Enabled after 45 s |
| `auth.reset_expired` † | This link has expired or was already used. Request a new one. | Reset page |
| `auth.password_changed` † | Password changed. Other devices have been signed out. | Toast |
| `auth.session_expired` † | You've been signed out. Sign in to continue. Your unsaved changes are kept. | Sign in, after a `401` ([UX-44](ux-standards.md#ux-44)) |
| `auth.signout_unsynced_one` † | You have 1 change not saved yet. Sign out anyway? | Dialog ([ADR-007](../07-architecture/decisions/ADR-007-session-and-auth.md)) |
| `auth.signout_unsynced_other` † | You have {count} changes not saved yet. Sign out anyway? | Dialog |
| `auth.signout_everywhere` † | Sign out on all devices | Account sheet (Should) |
| `auth.offline` † | You're offline. Connect to sign in. | Auth screens while offline |
| `auth.locked` † | Too many attempts. Try again in {seconds} s. | API error code for `429` on sign-in (the banner uses `auth.locked_title` / `auth.locked_body`) |

## Note capture (NC)

| Key | Text | Where |
|---|---|---|
| `note.placeholder` | Write a note… | Capture bar, editor |
| `note.make_tasks` | Make tasks | Editor primary button |
| `note.save_offline` | Save note | Editor primary button while offline |
| `note.saved_offline` † | Saved. It'll turn into tasks when you're back online. | Toast after Save note (NC) |
| `note.listening` | Listening… | Mic state ([NC-3](../03-modules/NC-note-capture.md#nc-3)) |
| `note.stop` | Stop | Mic state |
| `note.heard` | Here's what I heard. | After dictation |
| `note.mic_denied` † | Microphone access is off. Turn it on in your browser settings to dictate. | Mic permission denied |
| `note.mic_notice` † | Your browser turns speech into text using its own online service. | First mic use, Continue / Cancel (NC) |
| `note.no_speech` † | I didn't hear anything. Try again. | Dictation ended with no words |
| `note.dictation_failed` † | Dictation stopped. Check your connection and try again. | Dictation network error |
| `note.dictation_offline` † | Dictation needs a connection. | Mic disabled while offline |
| `note.reading_file` | Reading file… | Attach ([NC-4](../03-modules/NC-note-capture.md#nc-4)) |
| `note.file_too_big` | Attach a file under 5 MB. | File error |
| `note.file_type` † | This file type isn't supported. Try text, PDF, Word or a photo. | File error |
| `note.file_locked` † | This PDF is password-protected. Remove the password and try again. | File error |
| `note.file_no_text` † | I couldn't find any text in this file. | File error |
| `note.file_failed` † | I couldn't read this file. Try again, or paste the text instead. | File error (timeout, parser error) |
| `note.file_truncated` † | Only the first part of this file fits in a note. The rest wasn't added. | Extracted text over the limit ([NC-E9](../03-modules/NC-note-capture.md#nc-e9)) |
| `note.file_remove_title` † | Remove the text from this file too? | Removing an edited file chip. Buttons: Remove text / Keep text |
| `note.file_offline` † | Attaching a file needs a connection. | Paperclip disabled while offline |
| `note.from_file` | From {file_name} | Result screen line |
| `note.too_long` † | Notes can be up to 5,000 characters. This one has {count}. | Counter error ([NF-14](../05-quality/nfr.md#nf-14)) |
| `note.empty` † | Write something first. | Error if the text has nothing visible ([NU-E15](../03-modules/NU-note-understanding.md#nu-e15)) |
| `note.too_many_items` † | That's more than 30 things in one note. Split it into smaller notes. | Error result ([NU-E14](../03-modules/NU-note-understanding.md#nu-e14)) |
| `note.waiting` | Waiting for connection | Notes card, pending |
| `note.back_online_one` | Back online. 1 note turned into {tasks} tasks. | Toast ([NC-6](../03-modules/NC-note-capture.md#nc-6)) |
| `note.back_online_other` | Back online. {count} notes turned into {tasks} tasks. | Toast ([NC-6](../03-modules/NC-note-capture.md#nc-6)). `{tasks}` also takes `_one` |
| `note.needs_look_one` † | 1 needs a look. | Added to the back-online toast when a note ended in confirm or follow-up |
| `note.needs_look_other` † | {count} need a look. | Same |
| `note.couldnt_process` † | Couldn't turn this note into tasks. Tap to edit it. | Notes card, for a queued note rejected with a `422` |
| `note.discard_title` † | Discard this note? | Closing the editor with text |
| `note.discard_body` † | What you wrote won't be kept. | Same dialog |
| `note.draft_restored` † | Your unsent note is back. | Editor, after a restored draft ([UX-13](ux-standards.md#ux-13)) |
| `task.new` | New task | Sheet title ([NC-7](../03-modules/NC-note-capture.md#nc-7)) |
| `task.title_only` | Only a title is needed | Sheet helper |
| `task.added` | Added “{title}” | Toast |

## Note understanding and review (NU, RV)

| Key | Text | Where |
|---|---|---|
| `note.reading` † | Reading your note… | Editor busy state ([UX-02](ux-standards.md#ux-02)) |
| `note.made_one` | 1 task made | Result overline |
| `note.made_other` | {count} tasks made | Result overline |
| `note.overline_updated` † | {count} changed | Result overline and Notes card (`_one` uses the same text) |
| `note.overline_deleted` † | {count} deleted | Result overline |
| `note.summary` | I made {count} tasks from your note. | Result, screen-reader summary |
| `note.badge_created` | CREATED | Change badge |
| `note.badge_updated` | UPDATED | Change badge ([Q15](../08-project/open-questions.md#q15)) |
| `note.badge_deleted` | DELETED | Change badge |
| `note.was` | was {value} | Change meta, e.g. "Due Fri (was today)" |
| `note.undo_all` | Undo all | Result |
| `note.undone` † | Note undone. Its changes have been reversed. | Toast after Undo all |
| `note.undone_label` | Undone | Notes card and result status |
| `note.undo_expired` † | Notes can be undone for 30 days. | Replaces Undo all after the window ([RV-E2](../03-modules/RV-review-control.md#rv-e2)). Also the API code |
| `note.undo_conflict_title` † | Undo this note? | Dialog when tasks were edited after the note (RV) |
| `note.undo_conflict_body` † | {count} of its tasks were edited after it was made. Undoing removes them anyway. | Same dialog. Buttons: Undo all (red) / Cancel |
| `note.undo_conflicts` † | Some tasks from this note were edited since. | API code behind the dialog |
| `note.redo_expired` † | This can no longer be redone. | API code |
| `note.wrong_status` † | This note has already been handled. | API code `409` for an action that isn't valid in the note's status |
| `note.gone_since` † | Removed since | Result row for a task deleted after the note |
| `note.project_gone` † | Its project was deleted, so it's in No project. | Result row after undo ([RV-E3](../03-modules/RV-review-control.md#rv-e3)) |
| `note.kept_label` † | Kept as a note | Notes card status |
| `note.edited_label` † | Edited | Notes card, after the status line ([RV-5](../03-modules/RV-review-control.md#rv-5)) |
| `note.edit` † | Edit note | Result header menu ([RV-5](../03-modules/RV-review-control.md#rv-5)) |
| `note.replan` † | Make tasks again | Editor primary button when editing a saved note ([RV-5](../03-modules/RV-review-control.md#rv-5)) |
| `note.ask_when` † | When? | Result row for a created task with no date, before the chips Today / Tomorrow / Next week / Pick date… ([Q4](../08-project/open-questions.md#q4)) |
| `note.needs_connection` † | This needs a connection. | Disabled note actions while offline |
| `note.list_empty` † | Your notes will show here. Write one to get started. | Notes tab empty state |
| `note.confirm_title` | Check this first | Confirm screen ([NU-5](../03-modules/NU-note-understanding.md#nu-5)) |
| `note.confirm_body_one` † | This note will make 1 change. Nothing happens until you apply it. | Confirm screen |
| `note.confirm_body_other` † | This note will make {count} changes. Nothing happens until you apply it. | Confirm screen |
| `note.apply` | Apply changes | Confirm primary |
| `note.cancel_keep` † | Cancel and keep the note | Confirm secondary |
| `note.pick_task` † | Which task did you mean? | Tie ([NU-E11](../03-modules/NU-note-understanding.md#nu-e11)): candidates as radio buttons |
| `note.followup_title` | I couldn't find a task in this note. | Follow-up ([RV-3](../03-modules/RV-review-control.md#rv-3)) |
| `note.keep` | Keep as note | Follow-up |
| `note.make_one` | Make it a task | Follow-up |
| `note.skipped` † | Not made into tasks | Result section heading for skipped text |
| `note.skip_already_done` † | Already done: “{title}” | Skipped reason ([NU-E12](../03-modules/NU-note-understanding.md#nu-e12)) |
| `note.skip_not_found` † | Couldn't find a task matching “{text}” | Skipped reason ([NU-E29](../03-modules/NU-note-understanding.md#nu-e29)) |
| `note.duplicate_hint` † | You already have a task like this | Row hint ([NU-E13](../03-modules/NU-note-understanding.md#nu-e13)) |
| `note.processing_failed` † | I couldn't read this note just now. It's saved, and I'll try again. | Server error, note kept as pending |
| `task.created_by_assistant` | Created by the assistant | Task details ([NU-7](../03-modules/NU-note-understanding.md#nu-7)) |

## Tasks (TK)

| Key | Text | Where |
|---|---|---|
| `task.completed` | Completed “{title}” | Toast with Undo ([TK-1](../03-modules/TK-tasks.md#tk-1)) |
| `task.end_before_start` | End time must be later than the start time. | Field error ([TK-3](../03-modules/TK-tasks.md#tk-3)) |
| `task.delete_title` | Delete “{title}”? | Dialog ([TK-5](../03-modules/TK-tasks.md#tk-5)) |
| `task.deleted` | Deleted “{title}” | Toast with Undo |
| `task.repeat_scope_title` † | Delete a repeating task | Dialog title ([TK-4](../03-modules/TK-tasks.md#tk-4)) |
| `task.repeat_this` | This task only | Dialog option |
| `task.repeat_future` | This and all future | Dialog option |
| `task.limit` † | You've reached 5,000 open tasks. Complete or delete some to add more. | Error ([NF-14](../05-quality/nfr.md#nf-14)) |
| `task.reminder_past` † | This reminder time has already passed. | Helper under Reminder |
| `task.title_required` † | A task needs a title. | Title cleared in details (TK) |
| `task.reminder_needs_date` † | Add a date to set a reminder. | Reminder disabled without a date |
| `task.from_note` † | From note: {name} | Link in Task details for assistant tasks |
| `task.push_explainer` † | Get a notification before tasks with reminders? | In-app explainer before the browser prompt. Buttons: Allow / Not now |
| `task.push_denied` † | Notifications are off for Agendal. Turn them on in your browser settings. | Reminder field helper |
| `task.purged` † | This task can no longer be restored. | API code |

## Lists and search (LV)

| Key | Text | Where |
|---|---|---|
| `list.progress` | {done} of {total} done | Inbox summary ([LV-1](../03-modules/LV-lists-search.md#lv-1)) |
| `list.encourage_one` | Nice work! | Inbox, all done |
| `list.encourage_progress` | {done} down, {left} to go! | Inbox progress line |
| `list.overdue` | Overdue | Section heading |
| `list.today` | Today | Section heading |
| `list.tomorrow` | Tomorrow | Upcoming day heading |
| `list.nothing_left` | Nothing left for today | Inbox empty state |
| `list.no_date` † | No date | Inbox section (LV) |
| `list.completed` † | Completed | Inbox section |
| `list.first_run` † | Write a note to make your first tasks. | Inbox when the user has no tasks at all |
| `list.filter_empty` † | Nothing matches this filter. Show all | Upcoming with a filter and no results |
| `list.see_upcoming` † | See what's coming | Link from the empty state to Upcoming |
| `list.filter_all` | All | Chip |
| `list.filter_scheduled` | Scheduled | Chip |
| `list.filter_due` | Due only | Chip |
| `list.upcoming_empty` † | Nothing coming up. Write a note to plan ahead. | Upcoming empty state |
| `search.placeholder` † | Search tasks | Search field |
| `search.filter_open` | Open | Chip |
| `search.filter_completed` | Completed | Chip |
| `search.no_match` | No tasks match “{query}” | Empty result ([LV-3](../03-modules/LV-lists-search.md#lv-3)) |
| `search.hint` † | Search titles and notes | Search with an empty query |
| `search.offline` † | Showing results saved on this device | Search footer while offline |

## Projects (PJ)

| Key | Text | Where |
|---|---|---|
| `project.none` | No project | List row, picker |
| `project.new` | New project | Button, sheet title |
| `project.progress` | {done} of {total} tasks completed | Project screen ([PJ-2](../03-modules/PJ-projects.md#pj-2)) |
| `project.delete_title` | Delete “{name}”? | Dialog ([PJ-4](../03-modules/PJ-projects.md#pj-4)) |
| `project.delete_body_one` | It has 1 task. What should happen to it? | Dialog |
| `project.delete_body_other` | It has {count} tasks. What should happen to them? | Dialog |
| `project.move_tasks` † | Move to No project | Dialog option |
| `project.delete_tasks` † | Delete them too | Dialog option, red |
| `project.deleted` † | Deleted “{name}” | Toast with Undo |
| `project.name_taken` † | You already have a project called “{name}”. | Field error ([NF-14](../05-quality/nfr.md#nf-14)) |
| `project.limit` † | You can have up to 50 projects. | Error ([NF-14](../05-quality/nfr.md#nf-14)) |
| `project.list_empty` † | Group tasks by area or goal. | Projects empty state |
| `project.empty` † | No tasks yet | Project with no tasks |
| `project.show_completed` † | Show completed | Loads more completed tasks |
| `project.task_moved` † | “{title}” was added to a deleted project, so it's in No project. | Sync after a delete ([PJ-E4](../03-modules/PJ-projects.md#pj-e4)) |
| `project.purged` † | This project can no longer be restored. | API code |

## App and platform (AP)

| Key | Text | Where |
|---|---|---|
| `app.offline` | You're offline | Banner ([AP-2](../03-modules/AP-app-platform.md#ap-2)) |
| `app.offline_body` † | Changes are saved on this device and sync when you're back. | Banner body |
| `app.install_title` † | Install Agendal | Banner title ([AP-1](../03-modules/AP-app-platform.md#ap-1)) |
| `app.install` | Install | Banner action |
| `app.install_firefox` † | Open the menu, then Install. | Firefox Android guidance |
| `app.install_for_reminders` † | Install Agendal to get reminders on this iPhone. | iOS Safari, in place of the push explainer |
| `app.install_ios` † | Tap Share, then Add to Home Screen. | iOS guidance (no install prompt) |
| `app.dark_mode` | Dark mode | Account sheet (superseded by `app.appearance`, AP [Q20](../08-project/open-questions.md#q20)) |
| `app.appearance` † | Appearance | Account setting: System / Light / Dark |
| `app.week_start` † | Week starts on | Account setting: Monday / Sunday ([AP-5](../03-modules/AP-app-platform.md#ap-5)) |
| `app.time_format` † | Time format | Account setting: 24-hour / 12-hour ([AP-5](../03-modules/AP-app-platform.md#ap-5)) |
| `app.last_synced` † | Last synced {time} | Account sheet after repeated sync failures |
| `app.no_offline` † | Offline use isn't available in this browser mode. | When the service worker can't install |
| `app.update_ready` † | A new version is ready. | Toast with Reload ([UX-42](ux-standards.md#ux-42)) |
| `app.reload` † | Reload | Toast action |
| `app.conflict` † | “{title}” was also changed on another device. The latest edit was kept. | Toast (AP module) |
| `app.storage_low` † | Your device is low on storage. Offline notes might not be saved. | Banner |

## Errors (any screen)

| Key | Text | Where |
|---|---|---|
| `error.generic` † | Something went wrong. Try again. (Ref {request_id}) | 500 (ASVS 7.4.1) |
| `error.save_failed` † | Couldn't save that change. | Toast with Retry ([UX-01](ux-standards.md#ux-01)) |
| `error.slow` † | This is taking longer than usual. | After 10 s ([UX-03](ux-standards.md#ux-03)) |
| `error.rate_limited` † | You're going a bit fast. Try again in {seconds} s. | 429 ([UX-43](ux-standards.md#ux-43)) |
| `error.not_found` † | This item no longer exists. | 404 on a task, note or project |
| `error.invalid` † | Check the highlighted fields. | 422 without a more specific code |
