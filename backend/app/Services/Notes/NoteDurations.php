<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;
use RuntimeException;

/**
 * Relative amounts of time: "in 2 hours", "trong 30 phút", "3 ngày nữa", "after 2 weeks". The unit comes from
 * the "duration_unit:<unit>" family; a lead word (in, trong, sau …) or a trailing "nữa" marks it as relative.
 */
final class NoteDurations
{
    /** Minutes in each fixed unit of the "duration_unit" and "shift_unit" families; a month is added on the calendar. */
    public const MINUTES = ['minute' => 1, 'hour' => 60, 'day' => 1440, 'week' => 10080];

    private const CALENDAR_MONTH = 'month';

    /**
     * $at moved by $amount units. A month keeps the day of the month, or ends on the last day of a shorter month:
     * 31 Jan + 1 month is 28 Feb, not 3 Mar.
     */
    public static function add(DateTimeImmutable $at, int $amount, string $unit): DateTimeImmutable
    {
        if ($unit === self::CALENDAR_MONTH) {
            $month = $at->modify('first day of this month')->modify(sprintf('%+d months', $amount));

            return $month->setDate((int) $month->format('Y'), (int) $month->format('n'), min((int) $at->format('j'), (int) $month->format('t')));
        }
        if (! isset(self::MINUTES[$unit])) {
            throw new RuntimeException("No length for the duration unit {$unit}");
        }

        return $at->modify(sprintf('%+d minutes', $amount * self::MINUTES[$unit]));
    }

    /** Minutes and hours move a time; days, weeks and months move a date. */
    public static function isClock(string $unit): bool
    {
        return (self::MINUTES[$unit] ?? PHP_INT_MAX) < self::MINUTES['day'];
    }

    /**
     * Half of one unit in the smallest unit ("half an hour" is 30 minutes); null for a month.
     *
     * @return array{unit: string, amount: int}|null
     */
    public static function half(string $unit): ?array
    {
        return isset(self::MINUTES[$unit]) ? ['unit' => (string) array_key_first(self::MINUTES), 'amount' => intdiv(self::MINUTES[$unit], 2)] : null;
    }

    /** "09:30" → 570. */
    public static function clockMinutes(string $time): int
    {
        [$hour, $minute] = array_map(intval(...), explode(':', $time));

        return $hour * self::MINUTES['hour'] + $minute;
    }

    /** 570 → "09:30"; null outside one day (an end that would pass midnight, TK-3). */
    public static function clockTime(int $minutes): ?string
    {
        if ($minutes < 0 || $minutes >= self::MINUTES['day']) {
            return null;
        }

        return sprintf('%02d:%02d', intdiv($minutes, self::MINUTES['hour']), $minutes % self::MINUTES['hour']);
    }

    /** @return list<array{unit: string, amount: int, offset: int, length: int}> in text order */
    public function findAll(string $text): array
    {
        $found = [];
        foreach (NoteVocabulary::family('duration_unit') as $unit => $words) {
            $pattern = '~(?<![\p{L}\p{N}])(?:(?:'.NoteVocabulary::phrases('duration_prefix').')\s+(?<before>\d+)\s*(?:'.$words.')'
                .'|(?<after>\d+)\s*(?:'.$words.')\s+(?:'.NoteVocabulary::phrases('duration_suffix').'))(?![\p{L}\p{N}])~iu';
            preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
            foreach ($matches as $m) {
                $amount = ($m['before'][0] ?? '') !== '' ? $m['before'][0] : $m['after'][0];
                $found[] = ['unit' => (string) $unit, 'amount' => (int) $amount, 'offset' => $m[0][1], 'length' => strlen($m[0][0])];
            }
        }
        usort($found, fn (array $a, array $b): int => $a['offset'] <=> $b['offset']);

        return $found;
    }
}
