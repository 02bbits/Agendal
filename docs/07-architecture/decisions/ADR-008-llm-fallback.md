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
- **Validation:** the server validates the merged plan exactly like a rules plan: types, dates, ownership, and the safety rules. Anything invalid is dropped, and that item falls back to the rules result.
- **Latency:** a 1.5 s timeout per note. On timeout or error, the rules result is used and the note records `engine = rules_fallback`. The [NF-5](../../05-quality/nfr.md#nf-5) budget (2 s p90) holds either way.
- **Cost controls:**
  - ≤ 20 model calls per user per day (the rules result is used beyond that)
  - A global daily token budget
  - A kill switch (`NOTE_LLM_ENABLED=false`), which leaves the system on rules only
- **Privacy:** requests set `provider.data_collection: "deny"`, so they only go to providers that don't store or train on prompts, and OpenRouter doesn't log prompts unless the account opts in. Agendal also sends only the minimum above: no email, name, note ID or task notes, and only the low-confidence items rather than the whole note. Logs record latency, tokens and outcome, never text ([NF-9](../../05-quality/nfr.md#nf-9)). The key lives only in server `.env`.
- **Quality gate:** the golden note corpus runs in two modes (rules only, and rules + model). Each prompt and model change must keep both at or above the accuracy thresholds ([corpus](../../06-testing/note-corpus/README.md)). The prompt is versioned in the repo, and the model ID is set in `.env`.

## Consequences
- The model can only propose plans, and every plan is checked. The worst prompt injection can do is a wrong plan the user sees and can undo, and deletes are always confirmed.
- Latency varies by model and provider. Items that miss the 1.5 s timeout use the rules result, so a slow provider lowers accuracy, never speed.
- The model can be swapped by changing `.env`, as long as the corpus gates still pass.
- The app stays fully usable with the model off.
