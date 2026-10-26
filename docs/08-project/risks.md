# Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The assistant misreads a note (wrong date, split, or task) | Wrong tasks, and lost trust | The result screen lists every change. One-tap Undo all. Each task is editable from the result. Track edit and undo rates by phrase type |
| A command matches the wrong existing task | A task is wrongly completed, moved or deleted | 60% word-match threshold. Deletes always confirmed. Changes show the old value ("was today"). Undo all |
| Dates are ambiguous ("Friday" said on a Friday, 24-hour vs am/pm) | Tasks land on the wrong day | Weekdays always mean the next one ahead. Dates shown in full on the result. Easy edit |
| Offline notes processed later against changed tasks | Commands act on a different state than intended | Process in order on reconnect. The same confirm rules apply. The toast reports what happened |
| PWA limits on iOS (install prompt, push notifications) | Fewer installs and reminders on iPhone | Manual install guidance in Account. Reminders are a Should, not a Must. In-app Inbox works without push |
| Uploaded files contain personal data | Privacy exposure | Extract text and discard the file (NF-9). 5 MB limit. Clear file types |
| A language-model version is slow or costly | Slow result screen | Rules handle common phrases first, and the model handles the rest. 2 s p90 budget (NF-5) |
