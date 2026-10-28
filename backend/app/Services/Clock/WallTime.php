<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

final class WallTime
{
    private const TRANSITION_WINDOW_SECONDS = 2 * 24 * 60 * 60;

    private const SECONDS_PER_MINUTE = 60;

    /** Resolve floating local time according to ADR-006's DST rules. */
    public static function toUtc(string $date, string $time, string $timezone): DateTimeImmutable
    {
        $value = "{$date} {$time}";
        $utc = new DateTimeZone('UTC');
        $wall = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $value, $utc);
        if ($wall === false || $wall->format('Y-m-d H:i') !== $value) {
            throw new InvalidArgumentException("Invalid local date/time: {$value}");
        }

        $zone = new DateTimeZone($timezone);
        $wallTimestamp = $wall->getTimestamp();
        $transitions = $zone->getTransitions(
            $wallTimestamp - self::TRANSITION_WINDOW_SECONDS,
            $wallTimestamp + self::TRANSITION_WINDOW_SECONDS,
        );
        $offsets = $transitions === false
            ? [$zone->getOffset($wall)]
            : array_unique(array_column($transitions, 'offset'));
        $candidates = array_map(fn (int $offset): int => $wallTimestamp - $offset, $offsets);
        sort($candidates);

        foreach ($candidates as $candidate) {
            $instant = $wall->setTimestamp($candidate);
            if ($instant->setTimezone($zone)->format('Y-m-d H:i') === $value) {
                return $instant;
            }
        }

        // A forward jump skipped this minute. Choose the next valid local minute.
        $firstCandidate = min($candidates);
        $lastCandidate = max($candidates);
        $next = $wall->setTimestamp($lastCandidate);
        $nextLocal = PHP_INT_MAX;
        for ($candidate = $firstCandidate; $candidate <= $lastCandidate; $candidate += self::SECONDS_PER_MINUTE) {
            $instant = $wall->setTimestamp($candidate);
            $local = $candidate + $zone->getOffset($instant);
            if ($local >= $wallTimestamp && $local < $nextLocal) {
                $next = $instant;
                $nextLocal = $local;
            }
        }

        return $next;
    }
}
