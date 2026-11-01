<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use DateTime;
use DateTimeImmutable;
use InvalidArgumentException;
use RRule\RRule;

/** Calendar recurrence for floating local dates. Legacy enum-only tasks retain their existing behaviour. */
final class RepeatSchedule
{
    public static function validFor(?string $rule, string $repeat): bool
    {
        if ($rule === null) {
            return true;
        }
        try {
            self::rule($rule, '2000-01-01');

            return str_starts_with($rule.';', 'FREQ='.strtoupper($repeat).';');
        } catch (InvalidArgumentException) {
            return false;
        }
    }

    /** @return RRule<DateTime> */
    public static function rule(string $rule, string $anchor): RRule
    {
        if (strlen($rule) > 300 || preg_match('/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/D', $rule) !== 1) {
            throw new InvalidArgumentException('Invalid repeat rule.');
        }
        $parts = [];
        foreach (explode(';', $rule) as $part) {
            [$key, $value] = explode('=', $part, 2);
            if (! in_array($key, ['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'WKST', 'COUNT', 'UNTIL'], true) || isset($parts[$key])) {
                throw new InvalidArgumentException('Invalid repeat rule part.');
            }
            $parts[$key] = $value;
        }
        if ((int) ($parts['INTERVAL'] ?? 1) < 1 || (int) ($parts['INTERVAL'] ?? 1) > 999
            || (isset($parts['COUNT']) && ((int) $parts['COUNT'] < 1 || (int) $parts['COUNT'] > 10000))
            || (isset($parts['COUNT'], $parts['UNTIL']))) {
            throw new InvalidArgumentException('Invalid repeat interval or end.');
        }
        if (isset($parts['BYMONTH'], $parts['BYMONTHDAY'])) {
            $possible = false;
            foreach (explode(',', $parts['BYMONTH']) as $month) {
                foreach (explode(',', $parts['BYMONTHDAY']) as $day) {
                    $possible = $possible || ($day[0] === '-' ? (int) $day >= -31 : checkdate((int) $month, (int) $day, 2000));
                }
            }
            if (! $possible) {
                throw new InvalidArgumentException('No month can contain this date.');
            }
        }

        return new RRule($rule, new DateTimeImmutable($anchor.'T00:00:00+00:00'));
    }

    public static function onOrAfter(string $rule, string $anchor, string $date): ?string
    {
        self::rule($rule, $anchor);
        preg_match('/;INTERVAL=(\d+)/', $rule, $interval);
        preg_match('/;COUNT=(\d+)/', $rule, $count);
        preg_match('/;UNTIL=([A-Z0-9]+)/', $rule, $until);
        // Some valid RRULE combinations never match (e.g. February 29 every 4 years from 2027).
        // Bound the iterator itself, since an outer result limit cannot stop a rule yielding nothing.
        $year = min(9999, (int) substr($date, 0, 4) + 400 * (int) ($interval[1] ?? 1));
        $end = $year.'1231T235959Z';
        if (isset($until[1])) {
            $end = min($end, $until[1]);
        }
        $bounded = preg_replace('/;(?:COUNT|UNTIL)=[A-Z0-9]+/', '', $rule).';UNTIL='.$end;
        foreach (self::rule($bounded, $anchor) as $index => $occurrence) {
            if (isset($count[1]) && $index >= (int) $count[1]) {
                return null;
            }
            $next = $occurrence->format('Y-m-d');
            if ($next >= $date) {
                return $next;
            }
        }

        return null;
    }

    public static function describe(string $rule, string $anchor): string
    {
        return self::rule($rule, $anchor)->humanReadable(['locale' => 'en', 'include_start' => false]);
    }
}
