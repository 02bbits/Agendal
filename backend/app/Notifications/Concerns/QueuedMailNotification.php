<?php

declare(strict_types=1);

namespace App\Notifications\Concerns;

use Illuminate\Bus\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Shared queue settings for mail notifications (#193):
 * - `afterCommit()` ensures rolled-back DB transactions never send mail.
 * - Retries up to 3 times with backoff before logging a redacted failure.
 */
trait QueuedMailNotification
{
    use Queueable;

    public int $tries = 3;

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function failed(Throwable $exception): void
    {
        Log::warning('Queued mail notification failed.', [
            'notification' => static::class,
            'exception' => $exception::class,
        ]);
    }
}
