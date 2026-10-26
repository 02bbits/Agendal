# ADR-008 — Language-Model Fallback for Note Understanding

**Status:** Proposed. The provider is open (Q19).

## Context
Rules handle common phrases in a predictable, cheap and fast way. Students write more varied text than any rule set covers. A model can fill the gap, but it brings cost, latency, privacy and prompt-injection risks (ADR-001).

## Decision
- **When the model is called:** per **item**, only when the rules flag it as low-confidence:
  - It has a date- or time-like token the rules couldn't parse
  - It looks like a command but matches no open task
  - The rules extracted no verb or object
  - Notes with every item high-confidence never reach the model.
- **What the model sees:** the low-confidence items, `now`, the time zone, the names of the user's projects, and (for command-like items only) up to 20 candidate open-task titles with opaque IDs. It never sees the email, the display name, other notes, or task notes.
- **Output:** structured output against the plan JSON schema (ADR-001), temperature 0, no tools. It can reference existing tasks only by the candidate IDs it was given.
- **Validation:** the server validates the merged plan exactly like a rules plan: types, dates, ownership, and the safety rules. Anything invalid is dropped, and that item falls back to the rules result.
- **Latency:** a 1.5 s timeout per note. On timeout or error, the rules result is used and the note records `engine = rules_fallback`. The NF-5 budget (2 s p90) holds either way.
- **Cost controls:**
  - ≤ 20 model calls per user per day (the rules result is used beyond that)
  - A global daily token budget
  - A kill switch (`NOTE_LLM_ENABLED=false`), which leaves the system on rules only
- **Privacy:** a no-retention / no-training provider setting. Logs record latency, tokens and outcome, never text (NF-9). The key lives only in server `.env`.
- **Quality gate:** the golden note corpus runs in two modes (rules only, and rules + model). Each prompt and model change must keep both at or above the accuracy thresholds ([corpus](../../06-acceptance/note-corpus/README.md)). The prompt is versioned in the repo, and the model ID is set in `.env`.

## Consequences
- The model can only propose plans, and every plan is checked. The worst prompt injection can do is a wrong plan the student sees and can undo, and deletes are always confirmed.
- The app stays fully usable with the model off.
