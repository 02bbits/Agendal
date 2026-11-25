<?php

// API docs generated from the code (IM-08): /docs/api, /docs/api.json. Security schemes and the
// error shape are in App\Support\ApiDocs, with the viewApiDocs gate: open locally, elsewhere
// TELESCOPE_ALLOWED_EMAILS. Scramble's defaults cover everything not set here.
return [
    'api_path' => 'api/v1',

    'info' => [
        'version' => env('API_VERSION', '1.0.0'),
        'description' => <<<'MD'
            Agendal's JSON API. Conventions: `docs/07-architecture/api.md`.

            - **Auth:** Sanctum cookie session (ADR-007). `GET /sanctum/csrf-cookie`, then `POST /auth/login`. Writes send the `XSRF-TOKEN` cookie's value as `X-XSRF-TOKEN`.
            - **Time zone:** every request sends `X-Timezone` (an IANA zone, ADR-006).
            - **Errors:** one shape, `{"error": {"code", "message", "request_id", "fields"?}}`. `code` is a copy-catalog key. Someone else's resource is a `404`.
            - **Rate limits:** a `429` carries `Retry-After` and names the limit it hit.
            MD,
    ],

    'ui' => [
        'title' => 'Agendal API',
    ],
];
