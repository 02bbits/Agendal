# ADR-008 — Language-Model Fallback for Note Understanding

**Status:** Accepted ([Q16](../../08-project/open-questions.md#q16)). Provider ([Q19](../../08-project/open-questions.md#q19)): Gemini (`gemini-3.5-flash-lite`, its most stable model), on the team's key; DeepSeek and Claude are in the code but off for now; users add no keys. OpenRouter was the first choice, after DeepSeek, on 2026-10-26.

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
- **Provider:** one key held by the team. Only `gemini` runs: `gemini-3.5-flash-lite`, its most stable model (GA; in a local comparison it answered where `gemini-3.5-flash` and `gemini-3.7-flash` timed out), through its OpenAI-compatible chat completions API. `deepseek` (`deepseek-flash`, JSON mode) and `anthropic` (`claude-haiku-5-5`, through the Anthropic SDK) stay in the code and tests but are off (`enabled: false` in `config/note_llm.php`) until the team turns them on. `NOTE_LLM_MODEL` may name another Gemini model. Users add no keys.
- **Output:** Structured Outputs (`response_format: {type: "json_schema", json_schema: {name: "plan", strict: true, schema}}`) with the plan JSON schema ([ADR-001](ADR-001-note-plan-contract.md)), temperature 0, no tools. Providers get the schema without length, range, pattern and format bounds, and Claude gets nullable enums as `anyOf`; DeepSeek has JSON mode only (`response_format: {type: "json_object"}`), so its prompt carries the schema. The full schema still checks every answer. One item may get several create proposals (one per task it holds); any other action is one proposal per item. The prompt is versioned (`note-plan-v8`). The candidate task IDs are an `enum` in the schema, so the model can reference existing tasks only by the IDs it was given. The server still validates everything below.
- **Validation:** the server validates the merged plan exactly like a rules plan: types, dates, ownership, and the safety rules. Anything invalid is dropped, and that item falls back to the rules result. A change the model proposes to an existing task (complete, reschedule, delete) always waits for Apply, whatever `changes_to_confirm` says.
- **Latency:** a 1.5 s timeout per note (`NOTE_LLM_TIMEOUT_SECONDS`), with one retry when the provider answers 429 or 503. Free tiers measured 2–10 s locally, so local testing sets a longer timeout. On timeout or error, the rules result is used and the note records `engine = rules_fallback`. The [NF-5](../../05-quality/nfr.md#nf-5) budget (2 s p90) holds either way.
- **Cost controls:**
  - ≤ 20 model calls per user per day (`NOTE_LLM_DAILY_USER_CALLS`) and a global daily token budget (the rules result is used beyond that)
  - A kill switch (`NOTE_LLM_ENABLED=false`), which leaves the system on rules only
- **Privacy:** what a provider keeps follows its terms; free tiers such as Gemini's may keep prompts. Agendal always sends only the minimum above: no email, name, note ID or task notes, and only the low-confidence items rather than the whole note. Logs record latency, tokens and outcome, never text ([NF-9](../../05-quality/nfr.md#nf-9)). **Key:** only in a file that only the server account that runs PHP (e.g. `www-data`, not an Agendal user) can read (`GEMINI_API_KEY_FILE`, likewise `DEEPSEEK_API_KEY_FILE` and `ANTHROPIC_API_KEY_FILE`), never in `.env` itself. The file is read on each call, so `config:cache` never copies the key, and a new key works without a restart; without the file, or with an empty one, the rules answer. The key is never returned, logged or put in a URL, and the provider console restricts it to that API and the server's IP, with a spending cap.
- **Quality gate:** the golden note corpus runs in two modes (rules only, and rules + model). Each prompt and model change must keep both at or above the accuracy thresholds ([corpus](../../06-testing/note-corpus/README.md)). The prompt is versioned in the repo, and the provider and model are set in `.env`.

## Consequences
- The model can only propose plans, and every plan is checked. The worst prompt injection can do is a wrong plan the user sees and can undo: the model's changes to existing tasks always wait for review. A fixed injection set (`NotePromptInjectionTest`) plays a fooled model on every run.
- Latency varies by model and provider. Items that miss the 1.5 s timeout use the rules result, so a slow provider lowers accuracy, never speed.
- The provider or model can be swapped by changing `.env`, as long as the corpus gates still pass.
- The app stays fully usable with the model off.
