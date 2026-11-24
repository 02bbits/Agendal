<?php

declare(strict_types=1);

namespace App\Services\Clock;

use App\Enums\Reminder;
use InvalidArgumentException;

final class ReminderCalculator
{
    /** Parse any offset like 10m, 2h, 3d, 1w into minutes. */
    public static function parseMinutes(string $reminder): ?int
    {
        if ($reminder === 'none' || $reminder === '') {
            return null;
        }

        $legacy = Reminder::tryFrom($reminder);
        if ($legacy !== null) {
            return $legacy->minutes();
        }

        if (preg_match('/^(\d+)([mhdw])$/', $reminder, $matches)) {
            $value = (int) $matches[1];

            return match ($matches[2]) {
                'm' => $value,
                'h' => $value * 60,
                'd' => $value * 1440,
                'w' => $value * 10080,
            };
        }

        return null;
    }

    public function compute(string $dueDate, ?string $startTime, string $reminder, string $timezone): ?string
    {
        if ($reminder === 'none' || $reminder === '') {
            return null;
        }

        $minutes = self::parseMinutes($reminder);
        if ($minutes === null) {
            throw new InvalidArgumentException("Unknown reminder offset: {$reminder}");
        }

        $dueAt = WallTime::toUtc($dueDate, $startTime ?: '09:00', $timezone);

        // Subtract elapsed time in UTC, including when the interval crosses DST.
        return $dueAt->setTimestamp($dueAt->getTimestamp() - $minutes * 60)->format('Y-m-d\TH:i:s\Z');
    }

    /** Offset from the start (time, else 09:00), else from the due (time, else 09:00) (BR-12). */
    public function forDates(?string $startDate, ?string $startTime, ?string $dueDate, ?string $dueTime, string $reminder, string $timezone): ?string
    {
        if (! empty($startDate)) {
            return $this->compute($startDate, $startTime, $reminder, $timezone);
        }

        if (! empty($dueDate)) {
            return $this->compute($dueDate, $dueTime, $reminder, $timezone);
        }

        return null;
    }

    /** Explicit offset from the due date/time. */
    public function forDueDate(?string $dueDate, ?string $dueTime, string $dueReminder, string $timezone): ?string
    {
        if (empty($dueDate) || $dueReminder === 'none' || $dueReminder === '') {
            return null;
        }

        return $this->compute($dueDate, $dueTime, $dueReminder, $timezone);
    }
}
