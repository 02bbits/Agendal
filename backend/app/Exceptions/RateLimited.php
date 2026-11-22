<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Http\Exceptions\ThrottleRequestsException;

/**
 * A 429 that names the limit it hit (UX-43): `max` requests per `window` seconds. A one-second
 * window is a burst ("too fast"); a longer one is the most allowed in that time ("too many").
 */
final class RateLimited extends ThrottleRequestsException
{
    /** @param array<string, mixed> $headers */
    public function __construct(public readonly int $max, public readonly int $window, array $headers)
    {
        parent::__construct('Too Many Attempts.', null, $headers);
    }
}
