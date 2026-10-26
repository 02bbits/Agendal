# Data Model

Physical model for the [domain records](../02-domain/domain-overview.md). The DBMS is not chosen yet. Every table except `users` has `user_id`, and every query is scoped to it (NF-9).

| Table | Columns | Constraints / notes |
|---|---|---|
| `users` | id, email, display_name, password_hash, timezone, remember_device, theme (system / light / dark), install_prompt_shown, created_at | email unique, stored lower case. Argon2id hash, never logged (NF-10). `timezone` is an IANA name (ADR-006) |
| `projects` | id, user_id, name, colour, created_at, change_seq, deleted_at? | colour ∈ the 8 project tokens (PJ-1). UNIQUE (user_id, lower(name)) where not deleted. ≤ 50 per user (NF-14) |
| `tasks` | id, user_id, project_id?, title, due_date?, start_time?, end_time?, priority?, reminder?, repeat, notes?, done, done_at?, created_by, source_note_id?, created_at, updated_at, field_updated_at (json), remind_at?, repeat_anchor?, previous_occurrence_id?, change_seq, deleted_at? | CHECK end_time > start_time (TK-3). priority ∈ {low, medium, high}. repeat ∈ {never, daily, weekly, monthly, yearly}. created_by ∈ {user, assistant}. `field_updated_at` holds per-field timestamps for LWW (ADR-004). Dates and times are floating local values. `remind_at` is UTC (ADR-006). title ≤ 200, notes ≤ 5,000 (NF-14). `id` is a client-generated UUID v7. `previous_occurrence_id` is UNIQUE, so one completion makes one next occurrence ([M05](../03-modules/M05-tasks/spec.md#8-data-validation-and-authorization)) |
| `notes` | id, user_id, client_id, text, name?, source_file_name?, status, plan (json), applied (json), undo_log (json)?, engine, prompt_version?, written_at, written_tz, created_at, processed_at?, change_seq | UNIQUE (user_id, client_id) for idempotent replay (ADR-003). status ∈ {pending, new, done, confirm, followup, kept, undone}. engine ∈ {rules, rules_llm, rules_fallback} (ADR-008). text ≤ 5,000 (NF-14). `undo_log` holds the reverse log for the 10 s redo ([M04](../03-modules/M04-review-control/spec.md#8-data-validation-and-authorization)) |
| `password_resets` | user_id, token_hash, expires_at, used_at? | Single use, 60 min (AA-4) |
| `push_subscriptions` | user_id, endpoint, keys | TK-6 |
| `reminder_deliveries` | task_id, remind_at, sent_at | UNIQUE (task_id, remind_at), so each reminder is sent once |
| `audit_events` | id, user_id?, event, ip, user_agent, created_at | Kept 90 days (NF-20). No secrets |

`applied` is a list of `{kind, task_id, before, label}` ([note model](../02-domain/note-model.md#change)). Deletes set `deleted_at` (tombstones for sync, ADR-005). Rows are purged after 30 days, unless an undoable note still references them (ADR-002).

Indexes (all lead with `user_id`, [scalability](../05-non-functional-requirements/scalability.md)): `(user_id, change_seq)` on tasks, projects and notes for sync, `tasks (remind_at)` where not sent, `tasks (user_id, due_date)`, `tasks (user_id, done)`, and full-text on `tasks (title, notes)` for search (LV-3). `notes (user_id, created_at desc)` for the Notes tab (RV-4).
