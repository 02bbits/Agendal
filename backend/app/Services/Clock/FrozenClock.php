<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * FrozenClock for unit tests with pinned, controllable time.
 */
class FrozenClock implements ClockInterface
{
    private DateTimeImmutable $currentTime;

    public function __construct(string|DateTimeImmutable $initialTime = '2026-10-23T08:12:00+07:00')
    {
        if ($initialTime instanceof DateTimeImmutable) {
            $this->currentTime = $initialTime;
        } else {
            $this->currentTime = new DateTimeImmutable($initialTime);
        }
    }

    public function now(): DateTimeImmutable
    {
        return $this->currentTime->setTimezone(new DateTimeZone('UTC'));
    }

    public function today(string $timezone): string
    {
        return $this->currentTime
            ->setTimezone(new DateTimeZone($timezone))
            ->format('Y-m-d');
    }

    public function time(string $timezone): string
    {
        return $this->currentTime
            ->setTimezone(new DateTimeZone($timezone))
            ->format('H:i');
    }

    public function toLocal(DateTimeImmutable $instant, string $timezone): DateTimeImmutable
    {
        return $instant->setTimezone(new DateTimeZone($timezone));
    }

    public function advance(string $intervalSpec): void
    {
        $this->currentTime = $this->currentTime->modify($intervalSpec);
    }

    public function setTime(string|DateTimeImmutable $time): void
    {
        if ($time instanceof DateTimeImmutable) {
            $this->currentTime = $time;
        } else {
            $this->currentTime = new DateTimeImmutable($time);
        }
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
