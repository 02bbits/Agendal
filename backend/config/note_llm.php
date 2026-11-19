<?php

// Language-model fallback for low-confidence note items (ADR-008, NF-18).
return [

    // Kill switch: false keeps the app on rules only.
    'enabled' => env('NOTE_LLM_ENABLED', false),

    // openrouter (ADR-008); nvidia and gemini are for local testing only: their free tiers may keep prompts.
    'provider' => $provider = env('NOTE_LLM_PROVIDER', 'openrouter'),

    'key' => match ($provider) {
        'nvidia' => env('NVIDIA_API_KEY'),
        'gemini' => env('GEMINI_API_KEY'),
        default => env('OPENROUTER_API_KEY'),
    },

    // Must support structured outputs; changes must keep the corpus gates.
    'model' => env('NOTE_LLM_MODEL'),

    'url' => env('NOTE_LLM_URL', match ($provider) {
        'nvidia' => 'https://integrate.api.nvidia.com/v1/chat/completions',
        'gemini' => 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        default => 'https://openrouter.ai/api/v1/chat/completions',
    }),

    // Providers a user may add their own key for (Settings › AI). Each speaks the OpenAI chat format with
    // structured outputs; models_url lists what a key can use, and `models` keeps the ones that can plan a note.
    'providers' => [
        'gemini' => [
            'name' => 'Gemini',
            'url' => 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            'models_url' => 'https://generativelanguage.googleapis.com/v1beta/openai/models',
            'key_url' => 'https://aistudio.google.com/apikey',
            'models' => '~^gemini-(?!.*(?:embedding|tts|image|live|audio))~',
        ],
        'openrouter' => [
            'name' => 'OpenRouter',
            'url' => 'https://openrouter.ai/api/v1/chat/completions',
            // The model list is public; this one answers only for a working key.
            'check_url' => 'https://openrouter.ai/api/v1/key',
            'models_url' => 'https://openrouter.ai/api/v1/models?supported_parameters=structured_outputs',
            'key_url' => 'https://openrouter.ai/keys',
            'models' => '~.~',
        ],
        'openai' => [
            'name' => 'OpenAI',
            'url' => 'https://api.openai.com/v1/chat/completions',
            'models_url' => 'https://api.openai.com/v1/models',
            'key_url' => 'https://platform.openai.com/api-keys',
            'models' => '~^(?:gpt-|o\d)(?!.*(?:audio|realtime|transcribe|tts|image|search))~',
        ],
    ],

    // Seconds per note; on timeout or error the rules result stands (rules_fallback).
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
    'prompt_version' => env('NOTE_LLM_PROMPT_VERSION', 'note-plan-v8'),

];
