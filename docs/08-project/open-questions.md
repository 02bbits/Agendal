# Open Questions

| # | Question | Affects | Status |
|---|---|---|---|
| Q1 | What priority does **FR-67** (offline sync) have? It is blank in the source requirements. | M10, scope | Open |
| Q2 | Which AI provider and model? Which speech-to-text service? | NFR-2, NFR-12, budget | Open |
| Q3 | How are real-time updates across views delivered (Reverb/WebSockets, SSE, polling)? | FR-51 | Open |
| Q4 | Which database (MySQL / PostgreSQL) and where is it hosted? | data model, deployment | Open |
| Q5 | Undo after a manual edit of an affected task: overwrite the edit, skip that task, or refuse the undo? | FR-20, WF-02 | Open |
| Q6 | How long is undo available (until the next reply, a time window, or forever)? | FR-20 | Open |
| Q7 | Reopening a repeating task whose next occurrence already exists: keep both? | FR-28, FR-41 | Open |
| Q8 | Morning summary on a day with nothing due: skip it, or send "clear day"? | FR-54, WF-06 | Open |
| Q9 | Is an admin or support role needed (e.g. abuse handling, user support)? | actors, security | Open |
| Q10 | How long is conversation history kept? | FR-22, privacy | Open |
| Q11 | Should email verification be required at registration? | FR-01, security | Open |
