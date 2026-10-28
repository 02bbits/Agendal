<?php

declare(strict_types=1);

namespace App\Services\Clock;

use DateTimeImmutable;
use DateTimeZone;

/**
 * ClockInterface conforming to ADR-006.
 *
 * Requirements:
 * - Floating local dates and times
 * - remind_at computed in UTC
 * - Testing via FrozenClock with pinned time & timezone
 * - Zero unmocked now() calls across the app
 */
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

    /**
     * Compute UTC remind_at timestamp from floating local date/time + reminder offset + user timezone.
     *
     * @param string $dueDate Floating date (YYYY-MM-DD)
     * @param string|null $startTime Floating time (HH:mm) or null (defaults to 09:00)
     * @param string $reminder Offset enum: 'none', '5m', '15m', '30m', '1h', '1d'
     * @param string $timezone IANA timezone
     * @return string|null ISO-8601 UTC string (e.g. 2026-10-25T02:00:00Z) or null
     */
    public function computeRemindAtUtc(
        string $dueDate,
        ?string $startTime,
        string $reminder,
        string $timezone
    ): ?string;
}
