<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Exceptions\ApiError;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dictation (NC-3): the app's language model writes down a short WAV recording, word for word. The audio is sent
 * inline and never stored. Only a provider with audio input (Gemini, in the OpenAI chat format) can do it.
 */
final class NoteTranscriber
{
    /** The model says whether it heard speech at all: asked only for text, it makes up words for silence or noise. */
    private const SCHEMA = [
        'type' => 'object',
        'properties' => ['speech' => ['type' => 'boolean'], 'text' => ['type' => 'string']],
        'required' => ['speech', 'text'],
        'additionalProperties' => false,
    ];

    public function __construct(private NoteLlmFallback $llm) {}

    /** The words heard; empty when there was no speech. */
    public function transcribe(string $wav): string
    {
        $route = $this->llm->route();
        if ($route === null || $route['sdk'] || $route['output'] !== 'json_schema') {
            throw new ApiError('note.dictation_failed', 'Dictation is not available.', 503);
        }
        // Gemini usually answers in about 2 s but now and then stalls for 10–20 s or answers 503. A fresh call is
        // usually quick again, so each try is short and a stalled or busy one is tried again: the user waits at most
        // about attempts × timeout.
        $timeout = (float) config('note_llm.dictation_timeout_seconds');
        $prompt = (string) file_get_contents(resource_path('prompts/'.config('note_llm.dictation_prompt_version').'.txt'));

        try {
            $response = Http::withToken($route['key'])->connectTimeout($timeout)->timeout($timeout)
                ->retry((int) config('note_llm.dictation_attempts'), 200, fn (Throwable $e): bool => $e instanceof ConnectionException
                    || ($e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true)))
                ->post($route['url'], [
                    'model' => $route['model'],
                    'temperature' => 0,
                    'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'dictation', 'strict' => true, 'schema' => self::SCHEMA]],
                    'messages' => [['role' => 'user', 'content' => [
                        ['type' => 'text', 'text' => $prompt],
                        ['type' => 'input_audio', 'input_audio' => ['data' => base64_encode($wav), 'format' => 'wav']],
                    ]]],
                ])->throw();
            $answer = json_decode((string) $response->json('choices.0.message.content'), true, 4, JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            // The provider's status says which: 429 quota, 503 busy, 400 a request it refuses
            Log::warning('note_dictation', ['outcome' => 'failed', 'error' => $e::class,
                'status' => $e instanceof RequestException ? $e->response->status() : null]);
            throw new ApiError('note.dictation_failed', 'Dictation stopped.', 502);
        }

        return is_array($answer) && ($answer['speech'] ?? false) === true ? trim((string) ($answer['text'] ?? '')) : '';
    }
}
