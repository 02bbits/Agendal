# ADR-008 — Language-Model Fallback for Note Understanding

**Status:** Accepted ([Q16](../../08-project/open-questions.md#q16)). Provider: OpenRouter ([Q19](../../08-project/open-questions.md#q19), changed from DeepSeek on 2026-10-26).

## Context
Rules handle common phrases in a predictable, cheap and fast way. People write more varied text than any rule set covers. A model can fill the gap, but it brings cost, latency, privacy and prompt-injection risks ([ADR-001](ADR-001-note-plan-contract.md)).

## Decision
- **When the model is called:** per **item**, only when the rules flag it as low-confidence:
  - It has a date- or time-like token the rules couldn't parse
  - It looks like a command but matches no open task
  - The rules extracted no verb or object
  - Vietnamese typed without diacritics, which the rules don't read ([NU-E40](../../03-modules/NU-note-understanding.md#nu-e40))
  - Notes with every item high-confidence never reach the model.
- **What the model sees:** the low-confidence items, `now`, the time zone, the names of the user's projects, and (for command-like items only) up to 20 candidate open-task titles with opaque IDs. It never sees the email, the display name, other notes, or task notes.
- **Provider:** OpenRouter's chat completions API (OpenAI-compatible). The model ID is set in `.env` and must be one that supports structured outputs. Requests set `provider.require_parameters: true`, so OpenRouter routes only to providers that honour the schema.
- **Output:** Structured Outputs (`response_format: {type: "json_schema", json_schema: {name: "plan", strict: true, schema}}`) with the plan JSON schema ([ADR-001](ADR-001-note-plan-contract.md)), temperature 0, no tools. The candidate task IDs are an `enum` in the schema, so the model can reference existing tasks only by the IDs it was given. The server still validates everything below.
- **Validation:** the server validates the merged plan exactly like a rules plan: types, dates, ownership, and the safety rules. Invalid proposals hold the original item for follow-up; tentative rules writes are not applied.
- **Confidence routing (IM-38):** reading a date/time, finding an accent or recognizing a word inside an otherwise unsupported sentence is insufficient. Task extraction requires a supported task phrase at the start of the cleaned title; unknown wording and budget-expired plain titles stay low confidence. This is a bounded vocabulary gate, not a general language-understanding guarantee. Uncertain items may receive relevant user-owned candidate tasks even when the command verb was not recognized. In multi-target commands, only unresolved target clauses are sent, with their own refs; known siblings and their safety requirements remain intact, and their IDs are excluded from that unresolved target's candidates.
- **Calendar and copy proposals (prompt v2):** a create may include a nullable `repeat_rule` and a bounded `copies` count. The server validates the RRULE against `repeat`, aligns the first occurrence and expands independent copies with the same naming as rules. Replacing a create item replaces all its copy refs; replacing an unresolved command target preserves its known siblings. Proposals exceeding the note's total item limit keep the rules item. Multiple copies with one supplied time remain on rules because their time allocation is unresolved. Non-create proposals require `copies = 1` and `repeat_rule = null`.
- **Latency:** a 1.5 s timeout per note. On timeout or error, confident rules remain available, uncertain writes wait for follow-up, and the note records `engine = rules_fallback`. The [NF-5](../../05-quality/nfr.md#nf-5) budget (2 s p90) holds either way.
- **Cost controls:**
  - ≤ 20 model calls per user per day (uncertain writes wait beyond that)
  - A global daily token budget
  - A kill switch (`NOTE_LLM_ENABLED=false`), which leaves the system on rules only
- **Privacy:** requests set `provider.data_collection: "deny"`, so they only go to providers that don't store or train on prompts, and OpenRouter doesn't log prompts unless the account opts in. Agendal also sends only the minimum above: no email, name, note ID or task notes, and only the low-confidence items rather than the whole note. Logs record latency, tokens and outcome, never text ([NF-9](../../05-quality/nfr.md#nf-9)). The key lives only in server `.env`.
- **Quality gate:** the golden note corpus runs in two modes (rules only, and rules + model). Each prompt and model change must keep both at or above the accuracy thresholds ([corpus](../../06-testing/note-corpus/README.md)). The prompt is versioned in the repo, and the model ID is set in `.env`.

## Consequences

- **Field authority (approved 2026-11-03):** whole-item low confidence does not invalidate every parsed field. Input `known_fields` carries independently reliable, explicit rules evidence (date, clock/range, recurrence/copies, explicit priority and recognized project). Create proposals preserve those fields; reschedules preserve reliable due/start/end fields without changing candidate identity. Implied dates, unreadable/name/date spans, ambiguous bare Vietnamese/English weekday aliases, and unresolved unaccented day-period clocks are not promoted to reliable evidence. The LLM interprets unknown intent/title/fields. Server defaults are recomputed against the final merged schedule, including the default reminder when the model supplies no override. `processing[].source` may be `mixed`, with `field_sources` naming `rules`, `llm`, or `server` authority. Prompt v6 documents the boundary; changing prompts is not the enforcement mechanism—the merge enforces it even against a wrong or missing model date/time.

- **Per-item outcomes and safe fallback (approved 2026-11-03):** `processing` records each low ref's source (`llm` or `pending`), status (`accepted`, `skipped`, `unclear`, `rejected`, `missing`, `unavailable`) and reason. Missing/rejected/unavailable proposals remove provisional rules writes for that target and retain its original text for follow-up; they never execute a tentative create as though interpretation succeeded. Existing not-found/no-change skips and known sibling targets are retained. Provider, timeout, budget, configuration and invalid-response causes remain distinguishable without exposing credentials or raw errors. Prompt v5 asks about conflicting weekday/daily constraints, and modal observations stay low. The server supplies a missing date for an understood recurrence/time and rejects proposals that disagree with a single readable explicit clock.

- **Unclear (approved 2026-11-03):** prompt v4 adds the `unclear` action for requests whose action/object or constraints cannot be understood. It produces a skipped item with reason `unclear` and the original text. Unlike ordinary `skip` for filler/FYI, it holds the whole note in `followup` until the user submits a specific revised note. Explicit unresolved references without candidate context cannot be turned into creates even if a model invents a title. Rules retain this follow-up when the provider is disabled or fails. Other skip reasons retain their existing meanings.
- The model can only propose plans, and every plan is checked. The worst prompt injection can do is a wrong plan the user sees and can undo, and deletes are always confirmed.
- Latency varies by model and provider. Items that miss the 1.5 s timeout use the rules result, so a slow provider lowers accuracy, never speed.
- The model can be swapped by changing `.env`, as long as the corpus gates still pass.
- The app stays fully usable with the model off.
