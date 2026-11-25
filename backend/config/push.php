<?php

// Web Push reminders (TK-6, TK §2.5, #186).
return [
    // VAPID (RFC 8292). The private key comes only from a secret file, never from .env
    // (security.md SC-20 pattern). Make a pair with `php artisan push:vapid`.
    'vapid' => [
        'subject' => env('VAPID_SUBJECT', 'mailto:'.env('MAIL_FROM_ADDRESS', 'hello@example.com')),
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key_file' => env('VAPID_PRIVATE_KEY_FILE'),
    ],

    // SC-18: the server only ever posts to these push services, over HTTPS. A subscription
    // pointing anywhere else is refused, so the app can't be used to reach other hosts (SSRF).
    // A host matches itself and its subdomains.
    'hosts' => [
        'fcm.googleapis.com',               // Chrome, Edge on Android, Samsung Internet, Opera
        'updates.push.services.mozilla.com', // Firefox
        'push.apple.com',                   // Safari, iOS home-screen apps (web.push.apple.com)
        'notify.windows.com',               // Edge on Windows
    ],

    // TK §2.5: a reminder more than this late is skipped (after downtime, a burst helps nobody)
    'late_minutes' => 10,

    // Due reminders claimed per run, and per sending job
    'claim_limit' => 2000,
    'batch' => 100,

    // Pushes sent at once by one job (PERF-03: 300 in a minute, p95 ≤ 60 s)
    'concurrency' => 50,

    // Temporary failures (429, 5xx, network) are tried again this many times, 30 s apart
    'retries' => 2,
    'retry_seconds' => 30,

    // Per request to a push service
    'timeout' => 10,
    'connect_timeout' => 5,
];
