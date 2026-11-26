<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reads the words in a photo or a scanned PDF with Google Cloud Vision (NC §2.4, Q12): DOCUMENT_TEXT_DETECTION
 * with English and Vietnamese hints, the file sent inline and never through Cloud Storage. Null when Vision is
 * not set up or fails; the caller answers note.file_failed.
 */
final class VisionOcr
{
    /** Pages of a scanned PDF the synchronous API reads. */
    public const PDF_PAGES = 5;

    /** The text of a photo (JPEG, PNG or WebP). */
    public function image(string $bytes): ?string
    {
        $answer = $this->call('images:annotate', ['requests' => [[
            'image' => ['content' => base64_encode($bytes)],
            'features' => [['type' => 'DOCUMENT_TEXT_DETECTION']],
            'imageContext' => ['languageHints' => ['en', 'vi']],
        ]]]);

        return $answer === null ? null : (string) data_get($answer, 'responses.0.fullTextAnnotation.text', '');
    }

    /** The text of the first pages of a PDF without a text layer, a page after another. */
    public function pdf(string $bytes): ?string
    {
        $answer = $this->call('files:annotate', ['requests' => [[
            'inputConfig' => ['content' => base64_encode($bytes), 'mimeType' => 'application/pdf'],
            'features' => [['type' => 'DOCUMENT_TEXT_DETECTION']],
            'imageContext' => ['languageHints' => ['en', 'vi']],
            'pages' => range(1, self::PDF_PAGES),
        ]]]);
        if ($answer === null) {
            return null;
        }
        $pages = (array) data_get($answer, 'responses.0.responses', []);

        return implode("\n", array_map(fn (mixed $page): string => (string) data_get($page, 'fullTextAnnotation.text', ''), $pages));
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>|null
     */
    private function call(string $method, array $body): ?array
    {
        $key = $this->key();
        if ($key === null) {
            Log::warning('vision_ocr', ['outcome' => 'no_key']);

            return null;
        }
        $timeout = (float) config('services.vision.timeout_seconds');

        try {
            $response = Http::withHeaders(['X-Goog-Api-Key' => $key])->connectTimeout($timeout)->timeout($timeout)
                ->post('https://vision.googleapis.com/v1/'.$method, $body)->throw();
        } catch (Throwable $e) {
            Log::warning('vision_ocr', ['outcome' => 'failed', 'error' => $e::class,
                'status' => $e instanceof RequestException ? $e->response->status() : null]);

            return null;
        }
        $answer = $response->json();

        return is_array($answer) ? $answer : null;
    }

    /** The API key, read from its secret file on each call; never from the environment itself. */
    private function key(): ?string
    {
        $file = config('services.vision.key_file');
        if (! is_string($file) || $file === '' || ! is_file($file) || ! is_readable($file)) {
            return null;
        }
        $key = trim((string) file_get_contents($file));

        return $key === '' ? null : $key;
    }
}
