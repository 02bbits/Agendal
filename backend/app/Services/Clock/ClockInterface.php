<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;

/** Inject this clock wherever business logic needs the current time (IM-05). */
interface ClockInterface
{
    /**
     * Current instant in UTC.
     */
    public function now(): DateTimeImmutable;

    /**
     * Current floating local date (YYYY-MM-DD) in the specified IANA timezone.
     */
    public function today(string $timezone): string;

    /**
     * Current floating local time (HH:mm) in the specified IANA timezone.
     */
    public function time(string $timezone): string;

    /**
     * Convert an instant to floating local DateTime in the specified IANA timezone.
     */
    public function toLocal(DateTimeImmutable $instant, string $timezone): DateTimeImmutable;
}
