<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * #235: one `llm_call` log line per call to the language model, retries included: what for, which model, how it
 * went, how long, how many tokens. Never the prompt, the note, the file or the key (SC-21). The line carries the
 * request's request_id from Context, like every log line.
 */
final class LlmCallLog
{
    /**
     * Runs $call, logs it, and returns its result or rethrows its error.
     *
     * @template T
     *
     * @param  'note'|'ocr'|'dictation'  $kind
     * @param  Closure(): T  $call
     * @param  Closure(T): mixed  $tokens  the tokens the provider reports in the result
     * @return T
     */
    public static function run(string $kind, string $model, Closure $call, Closure $tokens): mixed
    {
        $started = hrtime(true);
        try {
            $result = $call();
        } catch (Throwable $e) {
            self::write($kind, $model, $started, match (true) {
                $e instanceof RequestException => 'http_'.$e->response->status(),
                $e instanceof ConnectionException => 'connection_failed_or_timeout',
                default => class_basename($e),
            }, null);

            throw $e;
        }
        $used = $tokens($result);
        self::write($kind, $model, $started, 'ok', is_numeric($used) ? (int) $used : null);

        return $result;
    }

    private static function write(string $kind, string $model, int $started, string $outcome, ?int $tokens): void
    {
        Log::info('llm_call', [
            'kind' => $kind,
            'provider' => (string) config('note_llm.provider'),
            'model' => $model,
            'outcome' => $outcome,
            'ms' => intdiv(hrtime(true) - $started, 1_000_000),
            'tokens' => $tokens,
        ]);
    }
}
