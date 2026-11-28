<?php

declare(strict_types=1);

namespace App\Services\Notes;

use GdImage;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use SensitiveParameter;
use Throwable;

/**
 * Reads the words in a photo or a scanned PDF for File to note (NC §2.4, Q12) with the app's language model
 * (Gemini), the file sent inline and never stored. It says first whether there is any writing, so a blank or
 * blurred photo gives nothing instead of made-up words. Null when the model is off or fails, or the photo can't be
 * decoded: the caller answers note.file_failed. A spent budget or another read still running answers 429.
 *
 * @phpstan-import-type Route from NoteLlmFallback
 */
final class NoteOcr
{
    /** Pages of a scanned PDF the model is sent; the caller cuts the rest and marks it truncated. */
    public const PDF_PAGES = 5;

    // ponytail: generous token reservations per photo and per scanned page, since Gemini's count depends on the
    // model and the image's size; the budget settles to what the provider reports. The answer fits in a note.
    private const IMAGE_TOKENS = 8192;

    private const PAGE_TOKENS = 2048;

    private const ANSWER_TOKENS = 5000;

    // ponytail: GD holds 4 bytes a pixel, so 30 MP is about 120 MB of the 256 MB memory_limit. A small PNG can
    // claim a huge size; one past this is refused before it is decoded.
    private const MAX_PIXELS = 30_000_000;

    private const SCHEMA = [
        'type' => 'object',
        'properties' => ['writing' => ['type' => 'boolean'], 'text' => ['type' => 'string']],
        'required' => ['writing', 'text'],
    ];

    public function __construct(private NoteLlmFallback $llm, private LlmBudget $budget) {}

    /**
     * The text of a photo; `$mime` is image/jpeg, image/png or image/webp. The photo is re-encoded first, so its
     * EXIF (place, time, camera) never reaches the model (SC-25).
     */
    public function image(string $bytes, string $mime, int $userId): ?string
    {
        $clean = $this->withoutMetadata($bytes, $mime);

        return $clean === null ? null : $this->read($clean, $mime, self::IMAGE_TOKENS, $userId);
    }

    /** The text of a PDF without a text layer, already cut to at most PDF_PAGES pages. */
    public function pdf(string $bytes, int $pages, int $userId): ?string
    {
        return $this->read($bytes, 'application/pdf', max(1, min($pages, self::PDF_PAGES)) * self::PAGE_TOKENS, $userId);
    }

    private function read(string $bytes, string $mime, int $fileTokens, int $userId): ?string
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
        $attempts = (int) config('note_llm.ocr_attempts');

        return $this->budget->spend($userId, $fileTokens + strlen($prompt) + self::ANSWER_TOKENS, (int) ceil($attempts * $timeout) + 5,
            fn (): array => $this->send($bytes, $mime, $prompt, $timeout, $attempts, $route));
    }

    /**
     * @param  Route  $route
     * @return array{?string, ?int}
     */
    private function send(string $bytes, string $mime, string $prompt, float $timeout, int $attempts, #[SensitiveParameter] array $route): array
    {
        try {
            // Gemini now and then stalls on a call that a fresh one answers quickly, so a stalled or busy try is made again
            $response = LlmCallLog::run('ocr', $route['model'], fn (): Response => Http::withHeaders(['X-Goog-Api-Key' => $route['key']])->connectTimeout($timeout)->timeout($timeout)
                ->retry($attempts, 200, fn (Throwable $e): bool => $e instanceof ConnectionException
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
                ])->throw(), fn (Response $r): mixed => $r->json('usageMetadata.totalTokenCount'));
            $answer = json_decode((string) $response->json('candidates.0.content.parts.0.text'), true, 4, JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            Log::warning('note_ocr', ['outcome' => 'failed', 'error' => $e::class,
                'status' => $e instanceof RequestException ? $e->response->status() : null]);

            return [null, null];
        }
        $used = $response->json('usageMetadata.totalTokenCount');

        return [
            is_array($answer) && ($answer['writing'] ?? false) === true ? trim((string) ($answer['text'] ?? '')) : '',
            is_numeric($used) ? (int) $used : null,
        ];
    }

    /** The photo decoded and encoded again, which drops every metadata block; turned upright first. */
    private function withoutMetadata(string $bytes, string $mime): ?string
    {
        $size = @getimagesizefromstring($bytes);
        if ($size === false || $size[0] * $size[1] > self::MAX_PIXELS) {
            return null;
        }
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            return null;
        }
        // The camera's rotation lives in the EXIF that is dropped, so it is applied to the pixels first
        if ($mime === 'image/jpeg') {
            $image = $this->upright($image, $bytes);
        }
        imagesavealpha($image, true);

        ob_start();
        $encoded = match ($mime) {
            'image/png' => imagepng($image),
            'image/webp' => imagewebp($image, null, 90),
            default => imagejpeg($image, null, 90),
        };
        $clean = (string) ob_get_clean();

        return $encoded && $clean !== '' ? $clean : null;
    }

    // ponytail: the three rotations phones write; mirrored orientations (2, 4, 5, 7) stay as they are
    private function upright(GdImage $image, string $bytes): GdImage
    {
        $stream = fopen('php://memory', 'r+');
        if ($stream === false) {
            return $image;
        }
        fwrite($stream, $bytes);
        rewind($stream);
        $exif = @exif_read_data($stream);
        fclose($stream);
        $angle = match (is_array($exif) ? ($exif['Orientation'] ?? 1) : 1) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };
        $rotated = $angle === 0 ? false : imagerotate($image, $angle, 0);

        return $rotated === false ? $image : $rotated;
    }
}
