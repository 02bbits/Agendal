<?php

return [
    'enabled' => env('NOTE_LLM_ENABLED', false),
    'key' => env('OPENROUTER_API_KEY'),
    'model' => env('NOTE_LLM_MODEL'),
    'daily_user_calls' => 20,
    'daily_tokens' => (int) env('NOTE_LLM_DAILY_TOKENS', 1000000),
    'max_completion_tokens' => 2048,
];
