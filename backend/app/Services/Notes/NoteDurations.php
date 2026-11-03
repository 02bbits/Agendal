<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;
use RuntimeException;

/**
 * Relative amounts of time: "in 2 hours", "trong 30 phút", "3 ngày nữa", "after 2 weeks". The unit comes from
 * the "duration_unit:<unit>" family; a lead word (in, trong, sau …) or a trailing relative marker (nữa, sau, later) marks it as relative.
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

    /** The same relative-duration grammar is used for extraction and comma boundaries. */
    public static function expression(): string
    {
        $amount = '(?:'.NoteVocabulary::phrases('amount_half').'|'.NoteVocabulary::integerPattern().')';
        $unit = '(?:'.implode('|', NoteVocabulary::family('duration_unit')).')';
        $quantity = $amount.'\s*'.$unit.'(?:\s+(?:'.NoteVocabulary::phrases('duration_fraction_suffix').'))?';

        return '(?<![\p{L}\p{N}.,/+\-])(?:(?:'.NoteVocabulary::phrases('duration_prefix').')\s+'.$quantity.'(?:\s+(?:'.NoteVocabulary::phrases('duration_suffix').'))?'
            .'|'.$quantity.'\s+(?:'.NoteVocabulary::phrases('duration_suffix').'))(?![\p{L}\p{N}])';
    }

    public function unreadable(string $text): bool
    {
        $durations = $this->findAll($text);
        preg_match_all('~'.self::expression().'~iu', $text, $matches);
        if (count($matches[0]) !== count($durations)) {
            return true;
        }
        // A relative clause containing an unknown/composite quantity must not be read only in part.
        $number = '(?:[+\-]?\d+(?:[.,]\d+)?|'.NoteVocabulary::phrases('amount_half').'|'.NoteVocabulary::integerPattern().')';
        $quantity = '(?:'.$number.'(?:\s+(?:(?:and|và)\s+)?'.$number.')*|\p{L}+)';
        $unit = '(?:'.implode('|', NoteVocabulary::family('duration_unit')).')';
        $pair = $quantity.'\s*'.$unit.'(?:\s+(?:'.NoteVocabulary::phrases('duration_fraction_suffix').'))?';
        $sequence = $pair.'(?:\s+(?:(?:and|và)\s+)?'.$pair.')*';
        $hint = '(?<![\p{L}\p{N}])(?:(?:'.NoteVocabulary::phrases('duration_prefix').')\s+'.$sequence.'(?:\s+(?:'.NoteVocabulary::phrases('duration_suffix').'))?'
            .'|'.$sequence.'\s+(?:'.NoteVocabulary::phrases('duration_suffix').'))(?![\p{L}\p{N}])';
        // Complete calendar phrases such as 'tuần sau' are dates, not unknown quantities.
        $dates = implode('|', NoteVocabulary::family('date_offset'));
        foreach (['week_next', 'week_end', 'weekend', 'month_end'] as $category) {
            $dates .= '|'.NoteVocabulary::phrases($category);
        }
        $hintsText = (string) preg_replace_callback(NoteVocabulary::pattern($dates), fn (array $match): string => str_repeat(' ', strlen($match[0])), $text);
        preg_match_all('~'.$hint.'~iu', $hintsText, $hints, PREG_OFFSET_CAPTURE);
        foreach ($hints[0] as [$phrase, $offset]) {
            $covered = false;
            foreach ($durations as $duration) {
                $covered = $covered || ($duration['offset'] === $offset
                    && $duration['length'] === strlen($phrase));
            }
            if (! $covered) {
                return true;
            }
        }

        return false;
    }

    /** @return list<array{unit: string, amount: int, offset: int, length: int}> in text order */
    public function findAll(string $text): array
    {
        preg_match_all('~'.self::expression().'~iu', $text, $matches, PREG_OFFSET_CAPTURE);
        $found = [];
        $quantity = '(?<amount>'.NoteVocabulary::phrases('amount_half').'|'.NoteVocabulary::integerPattern().')';
        foreach ($matches[0] as [$phrase, $offset]) {
            foreach (NoteVocabulary::family('duration_unit') as $unit => $words) {
                if (preg_match('~(?<![\p{L}\p{N}])'.$quantity.'\s*(?:'.$words.')(?![\p{L}\p{N}])(?:\s+(?<fraction>'.NoteVocabulary::phrases('duration_fraction_suffix').'))?~iu', $phrase, $match) !== 1) {
                    continue;
                }
                $half = preg_match('~^(?:'.NoteVocabulary::phrases('amount_half').')$~iu', $match['amount']) === 1;
                $number = NoteVocabulary::integer($match['amount']);
                $value = $half ? $this->exactHalf($unit) : ($number === null ? null : ['unit' => $unit, 'amount' => $number]);
                if (($match['fraction'] ?? '') !== '') {
                    $extra = $this->exactHalf($unit);
                    $value = ! $half && $number !== null && $extra !== null
                        && $number <= intdiv(PHP_INT_MAX - $extra['amount'], self::MINUTES[$unit])
                        ? ['unit' => $extra['unit'], 'amount' => $number * self::MINUTES[$unit] + $extra['amount']]
                        : null;
                }
                if ($value !== null) {
                    $found[] = [...$value, 'offset' => $offset, 'length' => strlen($phrase)];
                }
                break;
            }
        }

        return $found;
    }

    /**
     * A fractional month or sub-minute interval has no exact representation in this contract.
     *
     * @return array{unit: string, amount: int}|null
     */
    private function exactHalf(string $unit): ?array
    {
        $half = self::half($unit);

        return $half !== null && $half['amount'] > 0 ? $half : null;
    }
}
