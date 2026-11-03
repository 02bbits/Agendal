<?php

// Language-model fallback for low-confidence note items (ADR-008, NF-18).
return [

    // Kill switch: false keeps the app on rules only.
    'enabled' => env('NOTE_LLM_ENABLED', false),

    // Existing installations keep OpenRouter; .env.example selects NVIDIA for team testing.
    'provider' => env('NOTE_LLM_PROVIDER', 'openrouter'),

    'key' => env('NOTE_LLM_PROVIDER', 'openrouter') === 'nvidia' ? env('NVIDIA_API_KEY') : env('OPENROUTER_API_KEY'),

    // Must support structured outputs; changes must keep the corpus gates.
    'model' => env('NOTE_LLM_MODEL'),

    'url' => env('NOTE_LLM_URL', env('NOTE_LLM_PROVIDER', 'openrouter') === 'nvidia'
        ? 'https://integrate.api.nvidia.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions'),

    // Seconds per note; on timeout confident rules remain, while uncertain writes wait (rules_fallback).
    'timeout_seconds' => (float) env('NOTE_LLM_TIMEOUT_SECONDS', 1.5),

    // Relevant open-task titles an uncertain item may show the model.
    'candidate_limit' => (int) env('NOTE_LLM_CANDIDATE_LIMIT', 20),

    // Model calls one user may make per day, and tokens all users may spend per day.
    'daily_user_calls' => (int) env('NOTE_LLM_DAILY_USER_CALLS', 20),
    'daily_tokens' => (int) env('NOTE_LLM_DAILY_TOKENS', 1000000),

    'max_completion_tokens' => (int) env('NOTE_LLM_MAX_COMPLETION_TOKENS', 2048),

    // Optional: omit for models without this parameter; false disables reasoning on models that support it.
    'reasoning_enabled' => env('NOTE_LLM_REASONING_ENABLED'),

    // The versioned prompt in resources/prompts, recorded on each note that used it.
    'prompt_version' => env('NOTE_LLM_PROMPT_VERSION', 'note-plan-v6'),

];
