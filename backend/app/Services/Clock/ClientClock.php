<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;
use DateTimeZone;
use Exception;
use InvalidArgumentException;

/**
 * The client's "now": a note's written_at, pinned for date rules (ADR-006, NU-E26).
 */
final class ClientClock extends SystemClock
{
    private const ISO_WITH_OFFSET = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/';

    private const MAX_AHEAD = '+5 minutes';

    private const MAX_AGE = '-30 days';

    private function __construct(private DateTimeImmutable $instant) {}

    /** Clamped to server time + 5 min (SC-17). Older than 30 days → the server's processing time. */
    public static function fromWrittenAt(string $writtenAt, ClockInterface $server): self
    {
        if (preg_match(self::ISO_WITH_OFFSET, $writtenAt) !== 1) {
            throw new InvalidArgumentException("written_at must be ISO 8601 with an offset: {$writtenAt}");
        }
        try {
            $written = (new DateTimeImmutable($writtenAt))->setTimezone(new DateTimeZone('UTC'));
        } catch (Exception) {
            throw new InvalidArgumentException("Invalid written_at: {$writtenAt}");
        }

        $serverNow = $server->now();

        return new self(match (true) {
            $written > $serverNow->modify(self::MAX_AHEAD) => $serverNow->modify(self::MAX_AHEAD),
            $written < $serverNow->modify(self::MAX_AGE) => $serverNow,
            default => $written,
        });
    }

    public function now(): DateTimeImmutable
    {
        return $this->instant;
    }
}
