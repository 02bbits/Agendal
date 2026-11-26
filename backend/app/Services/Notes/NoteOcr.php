<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reads the words in a photo or a scanned PDF for File to note (NC §2.4, Q12) with the app's language model
 * (Gemini), the file sent inline and never stored. It says first whether there is any writing, so a blank or
 * blurred photo gives nothing instead of made-up words. Null when the model is off or fails: the caller answers
 * note.file_failed.
 */
final class NoteOcr
{
    /** Pages of a scanned PDF the model is asked to read; the rest is marked truncated. */
    public const PDF_PAGES = 5;

    private const SCHEMA = [
        'type' => 'object',
        'properties' => ['writing' => ['type' => 'boolean'], 'text' => ['type' => 'string']],
        'required' => ['writing', 'text'],
    ];

    public function __construct(private NoteLlmFallback $llm) {}

    /** The text of a photo; `$mime` is image/jpeg, image/png or image/webp. */
    public function image(string $bytes, string $mime): ?string
    {
        return $this->read($bytes, $mime);
    }

    /** The text of the first pages of a PDF without a text layer. */
    public function pdf(string $bytes): ?string
    {
        return $this->read($bytes, 'application/pdf');
    }

    private function read(string $bytes, string $mime): ?string
    {
        $route = $this->llm->route();
        // Only Gemini reads files here; Claude (the SDK route) and DeepSeek don't take them inline the same way
        if ($route === null || $route['sdk'] || config('note_llm.provider') !== 'gemini') {
            Log::warning('note_ocr', ['outcome' => 'model_off']);

            return null;
        }
        $prompt = str_replace('{pages}', (string) self::PDF_PAGES,
            (string) file_get_contents(resource_path('prompts/'.config('note_llm.ocr_prompt_version').'.txt')));
        $timeout = (float) config('note_llm.ocr_timeout_seconds');

        try {
            // Gemini now and then stalls on a call that a fresh one answers quickly, so a stalled or busy try is made again
            $response = Http::withHeaders(['X-Goog-Api-Key' => $route['key']])->connectTimeout($timeout)->timeout($timeout)
                ->retry((int) config('note_llm.ocr_attempts'), 200, fn (Throwable $e): bool => $e instanceof ConnectionException
                    || ($e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true)))
                ->post(sprintf((string) config('note_llm.gemini_generate_url'), $route['model']), [
                    'contents' => [['parts' => [
                        ['text' => $prompt],
                        ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
                    ]]],
                    'generationConfig' => [
                        'temperature' => 0,
                        'responseMimeType' => 'application/json',
                        'responseSchema' => self::SCHEMA,
                    ],
                ])->throw();
            $answer = json_decode((string) $response->json('candidates.0.content.parts.0.text'), true, 4, JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            Log::warning('note_ocr', ['outcome' => 'failed', 'error' => $e::class,
                'status' => $e instanceof RequestException ? $e->response->status() : null]);

            return null;
        }

        return is_array($answer) && ($answer['writing'] ?? false) === true ? trim((string) ($answer['text'] ?? '')) : '';
    }
}
