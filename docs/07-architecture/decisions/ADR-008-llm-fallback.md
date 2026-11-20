# ADR-008 — Language-Model Fallback for Note Understanding

**Status:** Accepted ([Q16](../../08-project/open-questions.md#q16)). Providers ([Q19](../../08-project/open-questions.md#q19)): the app's provider from `.env` (OpenRouter, Gemini or NVIDIA), and per user the provider of their own key (Claude, Gemini, OpenRouter, OpenAI). OpenRouter was the first choice, after DeepSeek, on 2026-10-26.

## Context
Rules handle common phrases in a predictable, cheap and fast way. People write more varied text than any rule set covers. A model can fill the gap, but it brings cost, latency, privacy and prompt-injection risks ([ADR-001](ADR-001-note-plan-contract.md)).

## Decision
- **When the model is called:** per **item**, only when the rules flag it as low-confidence:
  - It has a date- or time-like token the rules couldn't parse
  - It looks like a command but matches no open task
  - The rules extracted no verb or object
  - Vietnamese typed without diacritics, which the rules don't read ([NU-E40](../../03-modules/NU-note-understanding.md#nu-e40))
  - A move whose new date the rules can't read ("dời chạy bộ sang hôm khác"); the rules call it unclear, the model may still move an open task or make a task
  - Conversational filler (`note_chatter` in the rules: "mệt quá", "à mà", "i think"): then every item of the note goes, in order, so the model can join and skip fragments
  - Notes with every item high-confidence never reach the model. Neither does a reference the note doesn't explain ("cái đó", "vụ hôm qua nói"): the rules call it unclear, and without an open task to point at the server would keep it unclear anyway.
- **What the model sees:** the low-confidence items (the whole note when it has filler), `now`, the time zone, the names of the user's projects, and (for command-like items only) up to 20 candidate open-task titles with opaque IDs. It never sees the email, the display name, other notes, or task notes.
- **Provider:** by default the app's provider from `.env` (`NOTE_LLM_PROVIDER`): OpenRouter, Gemini or NVIDIA, each through its OpenAI-compatible chat completions API, with a model ID that supports structured outputs. On OpenRouter requests also set `provider.require_parameters: true`, so it routes only to providers that honour the schema. A user may instead add their own key per provider in Settings › LLM Provider ([AP §2.3.1](../../03-modules/AP-app-platform.md)) and pick a model: Claude through the Anthropic SDK (Messages API, `output_config.format` json_schema, effort low), and Gemini, OpenRouter and OpenAI through their OpenAI-compatible chat APIs. A key is checked with its provider (its model list) before it is kept, only models that can plan a note are offered (`note_llm.providers` in config, each with a default), and a picked model is tried with a one-token request before it is saved.
- **Output:** Structured Outputs (`response_format: {type: "json_schema", json_schema: {name: "plan", strict: true, schema}}`) with the plan JSON schema ([ADR-001](ADR-001-note-plan-contract.md)), temperature 0, no tools. Providers other than OpenRouter get the schema without length, range, pattern and format bounds; the full schema still checks the answer. One item may get several create proposals (one per task it holds); any other action is one proposal per item. The prompt is versioned (`note-plan-v8`). The candidate task IDs are an `enum` in the schema, so the model can reference existing tasks only by the IDs it was given. The server still validates everything below.
- **Validation:** the server validates the merged plan exactly like a rules plan: types, dates, ownership, and the safety rules. Anything invalid is dropped, and that item falls back to the rules result.
- **Latency:** a 1.5 s timeout per note (`NOTE_LLM_TIMEOUT_SECONDS`), with one retry when the provider answers 429 or 503. Free tiers measured 2–10 s locally, so local testing sets a longer timeout. On timeout or error, the rules result is used and the note records `engine = rules_fallback`. The [NF-5](../../05-quality/nfr.md#nf-5) budget (2 s p90) holds either way.
- **Cost controls:**
  - ≤ 20 model calls per user per day and a global daily token budget, on the app's key only (the rules result is used beyond that); a user's own key spends their own quota
  - A kill switch (`NOTE_LLM_ENABLED=false`), which leaves the system on rules only, and a per-user switch in Settings › LLM Provider
- **Privacy:** what a provider keeps depends on the provider: OpenRouter requests set `provider.data_collection: "deny"`, so they only go to providers that don't store or train on prompts; free tiers such as Gemini's may keep prompts, and a user's own key follows that provider's terms. Agendal always sends only the minimum above: no email, name, note ID or task notes, and only the low-confidence items rather than the whole note. Logs record latency, tokens and outcome, never text ([NF-9](../../05-quality/nfr.md#nf-9)). The app's key lives only in server `.env`; a user's own keys are stored encrypted (`users.llm_keys`), never returned (only their last four characters) and never logged.
- **Quality gate:** the golden note corpus runs in two modes (rules only, and rules + model). Each prompt and model change must keep both at or above the accuracy thresholds ([corpus](../../06-testing/note-corpus/README.md)). The prompt is versioned in the repo, and the model ID is set in `.env`.

## Consequences
- The model can only propose plans, and every plan is checked. The worst prompt injection can do is a wrong plan the user sees and can undo, and deletes are always confirmed.
- Latency varies by model and provider. Items that miss the 1.5 s timeout use the rules result, so a slow provider lowers accuracy, never speed.
- The app's model can be swapped by changing `.env`, as long as the corpus gates still pass. A model a user picks with their own key is outside those gates.
- The app stays fully usable with the model off.
