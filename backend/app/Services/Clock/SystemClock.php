<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;
use DateTimeZone;

/**
 * SystemClock reads Laravel's clock, so travelTo() in a test pins this and Eloquent timestamps together.
 */
class SystemClock implements ClockInterface
{
    public function now(): DateTimeImmutable
    {
        return now('UTC')->toDateTimeImmutable();
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
}
