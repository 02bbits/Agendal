<?php

// Language-model fallback for low-confidence note items (ADR-008, NF-18).
return [

    // Kill switch: false keeps the app on rules only.
    'enabled' => env('NOTE_LLM_ENABLED', false),

    'key' => env('OPENROUTER_API_KEY'),

    // Must support structured outputs; changes must keep the corpus gates.
    'model' => env('NOTE_LLM_MODEL'),

    'url' => env('NOTE_LLM_URL', 'https://openrouter.ai/api/v1/chat/completions'),

    // Seconds per note; on timeout the rules result stands (engine = rules_fallback).
    'timeout_seconds' => (float) env('NOTE_LLM_TIMEOUT_SECONDS', 1.5),

    // Open-task titles a command-like item may show the model.
    'candidate_limit' => (int) env('NOTE_LLM_CANDIDATE_LIMIT', 20),

    // Model calls one user may make per day, and tokens all users may spend per day.
    'daily_user_calls' => (int) env('NOTE_LLM_DAILY_USER_CALLS', 20),
    'daily_tokens' => (int) env('NOTE_LLM_DAILY_TOKENS', 1000000),

    'max_completion_tokens' => (int) env('NOTE_LLM_MAX_COMPLETION_TOKENS', 2048),

    // The versioned prompt in resources/prompts, recorded on each note that used it.
    'prompt_version' => env('NOTE_LLM_PROMPT_VERSION', 'note-plan-v1'),

];
