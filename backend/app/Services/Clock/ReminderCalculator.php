<?php

declare(strict_types=1);

namespace App\Services\Clock;

use InvalidArgumentException;

final class ReminderCalculator
{
    public function compute(string $dueDate, ?string $startTime, string $reminder, string $timezone): ?string
    {
        if ($reminder === 'none' || $reminder === '') {
            return null;
        }

        $minutes = match ($reminder) {
            '5m' => 5,
            '15m' => 15,
            '30m' => 30,
            '1h' => 60,
            '1d' => 1440,
            default => throw new InvalidArgumentException("Unknown reminder offset: {$reminder}"),
        };

        $dueAt = WallTime::toUtc($dueDate, $startTime ?: '09:00', $timezone);

        // Subtract elapsed time in UTC, including when the interval crosses DST.
        return $dueAt->setTimestamp($dueAt->getTimestamp() - $minutes * 60)->format('Y-m-d\TH:i:s\Z');
    }
}
