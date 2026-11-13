<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Throwable;

/**
 * A per-field last-write-wins stamp (ADR-004): the write's time in UTC to the millisecond, and the
 * device that made it, as `2026-10-23T01:12:00.123Z~<device uuid>`. The device breaks a tie in
 * the same millisecond; a server write has none. Older stamps (whole seconds, no device) still read.
 */
final class Stamp
{
    public const DEVICE_HEADER = 'X-Device-Id';

    private const SEPARATOR = '~';

    /** A stamp for `at`, made by the device the current request comes from. */
    public static function of(DateTimeInterface $at): string
    {
        $time = DateTimeImmutable::createFromInterface($at)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
        $device = self::device();

        return $device === null ? $time : $time.self::SEPARATOR.$device;
    }

    /**
     * Whether `candidate` beats `stored`: a later millisecond wins; in the same millisecond the
     * greater device id wins; the same device in the same millisecond wins too, since one device's
     * edits arrive in the order they were made (its queue is ordered).
     */
    public static function wins(string $candidate, ?string $stored): bool
    {
        if ($stored === null || $stored === '') {
            return true;
        }
        try {
            $byTime = self::time($candidate) <=> self::time($stored);
        } catch (Throwable) {
            return true;
        }

        return $byTime > 0 || ($byTime === 0 && strcmp(self::deviceOf($candidate), self::deviceOf($stored)) >= 0);
    }

    /** The time part, to the millisecond. */
    public static function time(string $stamp): DateTimeImmutable
    {
        $time = (new DateTimeImmutable(explode(self::SEPARATOR, $stamp, 2)[0]))->setTimezone(new DateTimeZone('UTC'));

        // Compared at the stored precision: microseconds would make an equal stamp look later
        return $time->setTime((int) $time->format('H'), (int) $time->format('i'), (int) $time->format('s'), (int) $time->format('v') * 1000);
    }

    private static function deviceOf(string $stamp): string
    {
        return explode(self::SEPARATOR, $stamp, 2)[1] ?? '';
    }

    /** The calling device's id (`X-Device-Id`), when it is a UUID. */
    private static function device(): ?string
    {
        if (! app()->bound('request')) {
            return null;
        }
        $id = request()->header(self::DEVICE_HEADER);

        return is_string($id) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id) === 1
            ? strtolower($id)
            : null;
    }
}
