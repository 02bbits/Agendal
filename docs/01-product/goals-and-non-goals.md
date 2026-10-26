# Goals and Non-Goals

## Goals

1. Capturing several tasks takes one note and under 15 seconds.
2. The assistant is right often enough that people trust it. When it is wrong, fixing or undoing it takes one tap.
3. People see what needs doing today at a glance, every time they open the app.
4. It works offline and installs like an app on any modern phone.

## Success metrics

Proposed targets for the first 8 weeks after launch, to be confirmed before the beta. How each is measured: [observability](../05-non-functional-requirements/observability.md).

| Metric | Definition | Target |
|---|---|---|
| Note-to-task share | Share of new tasks created from notes rather than the manual sheet | ≥ 70% |
| Note acceptance | Share of processed notes not undone within 24 hours | ≥ 90% |
| Edit rate | Share of assistant-made tasks edited within 24 hours | ≤ 20% |
| Follow-up rate | Share of notes where the assistant had to ask what to do | ≤ 10% |
| Time to capture | Median time from opening the note editor to Make tasks | ≤ 15 s |
| Weekly retention | Users active in week 4 ÷ users active in week 1 | ≥ 40% |
| Completion | Share of tasks due in a week that are completed by the end of that week | ≥ 60% |
| Install rate | Signed-in users who install the PWA | ≥ 30% |

## Non-goals for v1

- Shared lists, or assigning tasks to other people
- Calendar sync
- Chat with the assistant
- A desktop-first layout
- Native iOS or Android apps
