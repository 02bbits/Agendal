<?php

// Language-model fallback for low-confidence note items (ADR-008, NF-18).
return [

    // Kill switch: false keeps the app on rules only.
    'enabled' => env('NOTE_LLM_ENABLED', false),

    // The app's provider. Only gemini runs for now; deepseek and anthropic stay in the code, off (`enabled`), until the
    // team turns them on. The team holds the key; users add none.
    'provider' => $provider = env('NOTE_LLM_PROVIDER', 'gemini'),

    // The provider key lives only in a file (e.g. a Docker secret) that only the server account running PHP can read,
    // such as www-data; no Agendal user ever sees it, and it is never in .env.
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

    // Seconds per model call; on timeout or error the rules result stands (rules_fallback). Gemini's free tier took
    // 2–30 s in testing. With one more call for an invalid answer, a note waits at most about twice this.
    'timeout_seconds' => (float) env('NOTE_LLM_TIMEOUT_SECONDS', 20),

    // Relevant open-task titles an uncertain item may show the model.
    'candidate_limit' => (int) env('NOTE_LLM_CANDIDATE_LIMIT', 20),

    // Model calls one user may make per day, and tokens all users may spend per day.
    'daily_user_calls' => (int) env('NOTE_LLM_DAILY_USER_CALLS', 20),
    'daily_tokens' => (int) env('NOTE_LLM_DAILY_TOKENS', 1000000),

    // Room for a plan of a long note (a 22-item meeting note took ~2,450 tokens); a cut-off answer is invalid JSON.
    'max_completion_tokens' => (int) env('NOTE_LLM_MAX_COMPLETION_TOKENS', 8192),

    // A note of at least this many items with any uncertain one goes to the model whole, like a chatty note: in a long
    // meeting note, sentences the rules read as tasks ("Warehouse stock is a bit messy") are often just context.
    'whole_note_items' => (int) env('NOTE_LLM_WHOLE_NOTE_ITEMS', 10),

    // The versioned prompt in resources/prompts, recorded on each note that used it.
    'prompt_version' => env('NOTE_LLM_PROMPT_VERSION', 'note-plan-v9'),

    // Dictation (NC-3): the model writes down a recording. Its prompt, and the largest WAV accepted (60 s at 16 kHz
    // mono is about 1.9 MB).
    'dictation_prompt_version' => env('NOTE_DICTATION_PROMPT_VERSION', 'note-dictation-v1'),
    'dictation_max_kb' => (int) env('NOTE_DICTATION_MAX_KB', 2048),

    // Seconds per try and tries per recording: Gemini now and then stalls on a call that a fresh one answers in about
    // 2 s, so a short try is cut and made again. The user waits at most about their product.
    'dictation_timeout_seconds' => (float) env('NOTE_DICTATION_TIMEOUT_SECONDS', 8),
    'dictation_attempts' => (int) env('NOTE_DICTATION_ATTEMPTS', 2),

];
