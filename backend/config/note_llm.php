<?php

// Language-model fallback for low-confidence note items (ADR-008, NF-18).
return [

    // Kill switch: false keeps the app on rules only.
    'enabled' => env('NOTE_LLM_ENABLED', false),

    // The app's provider. Only gemini runs for now; deepseek and anthropic stay in the code, off (`enabled`), until the
    // team turns them on. The team holds the key; users add none.
    'provider' => $provider = env('NOTE_LLM_PROVIDER', 'gemini'),

    // The provider key lives only in a file the app's user alone can read (e.g. a Docker secret), never in .env.
    // The file is read on each call, so `config:cache` never copies the key into bootstrap/cache. Without it, rules only.
    'key_file' => env(match ($provider) {
        'deepseek' => 'DEEPSEEK_API_KEY_FILE',
        'anthropic' => 'ANTHROPIC_API_KEY_FILE',
        default => 'GEMINI_API_KEY_FILE',
    }),

    // Empty: the provider's cheapest model below. Changes must keep the corpus gates.
    'model' => env('NOTE_LLM_MODEL') ?: null,

    // `model`: the provider's most stable model (GA, not a preview or a -latest alias).
    // `output`: json_schema constrains the answer to the plan schema; json_object (DeepSeek) only to JSON, so the
    // schema goes in the prompt. The server checks every answer against the full schema either way.
    'providers' => [
        'gemini' => [
            'url' => 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            'enabled' => true,
            'model' => 'gemini-3.5-flash-lite',
            'output' => 'json_schema',
        ],
        'deepseek' => [
            'url' => 'https://api.deepseek.com/chat/completions',
            'enabled' => false,
            'model' => 'deepseek-flash',
            'output' => 'json_object',
        ],
        // Claude goes through the official Anthropic SDK (ClaudeMessages), not the OpenAI chat format.
        'anthropic' => [
            'enabled' => false,
            'sdk' => 'anthropic',
            'model' => 'claude-haiku-5-5',
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

    // The versioned prompt in resources/prompts, recorded on each note that used it.
    'prompt_version' => env('NOTE_LLM_PROMPT_VERSION', 'note-plan-v8'),

];
