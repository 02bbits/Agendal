<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * SystemClock reads real system time.
 */
class SystemClock implements ClockInterface
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    public function today(string $timezone): string
    {
        return $this->now()
            ->setTimezone(new DateTimeZone($timezone))
            ->format('Y-m-d');
    }

    public function time(string $timezone): string
    {
        return $this->now()
            ->setTimezone(new DateTimeZone($timezone))
            ->format('H:i');
    }

    public function toLocal(DateTimeImmutable $instant, string $timezone): DateTimeImmutable
    {
        return $instant->setTimezone(new DateTimeZone($timezone));
    }

    public function computeRemindAtUtc(
        string $dueDate,
        ?string $startTime,
        string $reminder,
        string $timezone
    ): ?string {
        if ($reminder === 'none' || empty($reminder)) {
            return null;
        }

        $offsets = [
            '5m' => 5,
            '15m' => 15,
            '30m' => 30,
            '1h' => 60,
            '1d' => 1440,
        ];

        if (!isset($offsets[$reminder])) {
            throw new InvalidArgumentException("Unknown reminder offset: {$reminder}");
        }

        $timeStr = $startTime ?: '09:00';
        $tz = new DateTimeZone($timezone);
        $localDateTime = new DateTimeImmutable("{$dueDate} {$timeStr}:00", $tz);

        $offsetMinutes = $offsets[$reminder];
        $remindAt = $localDateTime->modify("-{$offsetMinutes} minutes");

        return $remindAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    }
}
