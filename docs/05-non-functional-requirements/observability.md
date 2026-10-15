# Observability

| ID | Name | Description |
|---|---|---|
| NFR-27 | Logging & monitoring | Laravel Telescope monitors requests, queries, jobs, mail, and exceptions (development/staging). Logs use a daily channel with 14-day retention; critical errors notify developers (email/Slack/Discord). Queries slower than 500 ms trigger an alert. Each AI request logs latency, token usage, and outcome without the message text; an AI error rate above 5% over 10 minutes alerts developers. Server monitoring alerts on CPU > 80% for 5 minutes or disk > 90%. |
