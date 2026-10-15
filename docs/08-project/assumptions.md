# Assumptions

| # | Assumption | If wrong |
|---|---|---|
| A1 | Users have a modern browser that supports service workers and Web Push (iOS 16.4+ for installed PWAs) | Reminders fall back to in-app only |
| A2 | A hosted LLM with tool/function calling is available and meets the 3 s / 10 s targets (NFR-2) | Revisit the model or provider. Manual flows still work |
| A3 | A speech-to-text service can return text within 2 s (NFR-2) | Voice input becomes a Later feature |
| A4 | One user = one person. No shared accounts or delegation | Collaboration needs new FRs and an authorization model |
| A5 | The user's time zone comes from the device, and can be changed in their profile | Relative-date resolution (FR-10) is wrong when travelling |
| A6 | AI usage cost per user stays acceptable under the rate limits in NFR-10 | Tighten limits or cache answers |
