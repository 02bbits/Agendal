# Performance

| ID | Name | Description |
|---|---|---|
| NFR-1 | Response time | The Inbox View loads within 3 seconds on a mid-range phone over 4G (Largest Contentful Paint ≤ 3 s at the 75th percentile). Manual operations (adding, editing, completing a task) respond within 1 second. |
| NFR-2 | Assistant response time | The assistant starts showing its reply within 3 seconds and finishes applying changes within 10 seconds for a message of up to 5 tasks (95th percentile). Voice transcription appears within 2 seconds after the user stops speaking. |
| NFR-3 | Resource loading optimization | The Next.js production build minifies, bundles, and code-splits JavaScript/CSS per route. React Server Components are used for data-heavy pages; heavy client components (assistant chat panel, voice recorder) are lazy-loaded with next/dynamic. Images use next/image and fonts use next/font; <Link> prefetches the main navigation routes. Lighthouse Performance score ≥ 80 on mobile. |
| NFR-4 | Caching | Inbox View, Upcoming, and project progress data are cached and invalidated whenever a task changes. Static resources have correct Cache-Control/ETag headers. The service worker caches the app shell. |
| NFR-5 | Asynchronous processing | Reminders, nudges, morning summaries, and creation of the next occurrence of repeating tasks run through Laravel queues. Failed jobs are retried up to 3 times and then written to failed_jobs. |
