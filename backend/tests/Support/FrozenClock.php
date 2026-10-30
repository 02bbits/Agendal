<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use DateTimeZone;

/**
 * FrozenClock for unit tests with pinned, controllable time.
 */
class FrozenClock implements ClockInterface
{
    private DateTimeImmutable $currentTime;

    public function __construct(string|DateTimeImmutable $initialTime)
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
}
