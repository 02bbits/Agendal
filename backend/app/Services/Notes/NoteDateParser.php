<?php

declare(strict_types=1);

namespace App\Services\Notes;

final class NoteDateParser
{
    private const DAYS_PER_WEEK = 7;

    private const SATURDAY = 6;

    private const SUNDAY = 0;

    /** Enough months ahead to reach a 31st from any month. */
    private const MONTHS_TO_FIND_A_DAY = 2;

    public function parse(string $text, NoteContext $context, ?string $startTime): ParsedDate
    {
        $unreadable = false;
        $best = null;
        foreach ($this->candidates($text, $context, $startTime) as $candidate) {
            $before = substr($text, 0, $candidate['offset']);
            if ($this->endsWith($before, 'name_title') !== null || $candidate['date'] === null) {
                // "chị Mai" may be a person, and "31/2" is no date: leave both to the LLM (NU-E31, ADR-008).
                $unreadable = true;

                continue;
            }
            $prefix = $this->endsWith($before, 'date_preferred_prefix');
            $candidate['preferred'] = $prefix !== null;
            $candidate['phrase'] = ($prefix ?? '').$candidate['phrase'];
            $best = $best === null || $this->wins($candidate, $best) ? $candidate : $best;
        }

        return new ParsedDate($best['date'] ?? null, $best['phrase'] ?? '', $unreadable);
    }

    /**
     * NU-E6: a date after by/due/on/before wins, otherwise the later date, otherwise the first one.
     *
     * @param  array{date: string, phrase: string, offset: int, preferred: bool}  $candidate
     * @param  array{date: string, phrase: string, offset: int, preferred: bool}  $best
     */
    private function wins(array $candidate, array $best): bool
    {
        return [$candidate['preferred'], $candidate['date'], -$candidate['offset']] > [$best['preferred'], $best['date'], -$best['offset']];
    }

    /** @return list<array{date: ?string, phrase: string, offset: int}> */
    private function candidates(string $text, NoteContext $context, ?string $startTime): array
    {
        return [
            ...$this->offsets($text, $context),
            ...$this->dayCounts($text, $context),
            ...$this->weekAndMonthEnds($text, $context),
            ...$this->weekdays($text, $context, $startTime),
            ...$this->numericDates($text, $context),
            ...$this->daysOfMonth($text, $context),
            ...$this->namedDates($text, $context),
        ];
    }

    /**
     * "today", "tomorrow", "ngày mốt", "in a week".
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function offsets(string $text, NoteContext $context): array
    {
        return array_map(fn (array $found): array => [
            'date' => $this->daysFromToday($context, (int) $found['key']),
            'phrase' => $found['phrase'],
            'offset' => $found['offset'],
        ], NoteVocabulary::findAll('date_offset', $text));
    }

    /**
     * "in 3 days", "3 ngày nữa".
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function dayCounts(string $text, NoteContext $context): array
    {
        $unit = NoteVocabulary::phrases('day_count_unit');
        $pattern = '~(?<![\p{L}\p{N}])(?:(?:'.NoteVocabulary::phrases('day_count_prefix').')\s+(?<before>\d+)\s*(?:'.$unit.')|(?<after>\d+)\s*(?:'.$unit.')\s+(?:'.NoteVocabulary::phrases('day_count_suffix').'))(?![\p{L}\p{N}])~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        return array_map(fn (array $m): array => [
            'date' => $this->daysFromToday($context, (int) ($m['before'][0] !== '' ? $m['before'][0] : $m['after'][0])),
            'phrase' => $m[0][0],
            'offset' => $m[0][1],
        ], $matches);
    }

    /**
     * "next week" → the week's first day (NU-E10), "end of the week" → its last day, "weekend" → Saturday
     * (today on a weekend day), "end of the month" → its last day (NU-E9).
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function weekAndMonthEnds(string $text, NoteContext $context): array
    {
        $today = $context->today();
        $weekday = (int) $today->format('w');
        $untilFirstDay = $this->daysUntil($weekday, $context->weekStart->firstDay()) ?: self::DAYS_PER_WEEK;
        $dates = [
            'week_next' => $this->daysFromToday($context, $untilFirstDay),
            'week_end' => $this->daysFromToday($context, $this->daysUntil($weekday, $context->weekStart->lastDay())),
            'weekend' => $this->daysFromToday($context, $weekday === self::SUNDAY ? 0 : $this->daysUntil($weekday, self::SATURDAY)),
            'month_end' => $today->modify('last day of this month')->format('Y-m-d'),
        ];
        $found = [];
        foreach ($dates as $category => $date) {
            preg_match_all(NoteVocabulary::pattern(NoteVocabulary::phrases($category)), $text, $matches, PREG_OFFSET_CAPTURE);
            foreach ($matches[0] as [$phrase, $offset]) {
                $found[] = ['date' => $date, 'phrase' => $phrase, 'offset' => $offset];
            }
        }

        return $found;
    }

    /**
     * Weekdays mean the next one ahead; "this" allows today (NU-E2, NU-E3); "every" allows today until its time (NU-E8).
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function weekdays(string $text, NoteContext $context, ?string $startTime): array
    {
        $today = (int) $context->today()->format('w');
        $found = [];
        foreach (NoteVocabulary::findAll('weekday', $text) as ['key' => $day, 'phrase' => $phrase, 'offset' => $offset]) {
            $before = substr($text, 0, $offset);
            $after = substr($text, $offset + strlen($phrase));
            $repeat = $this->endsWith($before, 'repeat_prefix');
            $thisPrefix = $this->endsWith($before, 'weekday_this');
            $next = $this->endsWith($before, 'weekday_next');
            $thisSuffix = preg_match('~^\s+(?:'.NoteVocabulary::phrases('weekday_this_suffix').')(?![\p{L}\p{N}_])~iu', $after, $suffix) === 1 ? $suffix[0] : '';
            $prefix = $repeat ?? $thisPrefix ?? $next ?? '';
            $days = $this->daysUntil($today, (int) $day);
            $todayAllowed = $thisPrefix !== null || $thisSuffix !== '' || ($repeat !== null && ($startTime === null || $startTime > $context->clock()));
            $found[] = [
                'date' => $this->daysFromToday($context, $days === 0 && ! $todayAllowed ? self::DAYS_PER_WEEK : $days),
                'phrase' => $prefix.$phrase.$thisSuffix,
                'offset' => $offset - strlen($prefix),
            ];
        }

        return $found;
    }

    /**
     * "26/10", "26/10/2026", "ngày 26/10": numbers are day/month (NU-E31).
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function numericDates(string $text, NoteContext $context): array
    {
        $separator = NoteVocabulary::phrases('date_separator');
        $pattern = '~(?<![\p{N}])(?:(?:'.NoteVocabulary::phrases('date_day_word').')\s+)?(?<day>\d{1,2})(?:'.$separator.')(?<month>\d{1,2})(?:(?:'.$separator.')(?<year>\d{4}))?(?![\p{N}])(?!(?:'.$separator.')\d)~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        return array_map(fn (array $m): array => [
            'date' => $this->explicitDate($context, (int) $m['day'][0], (int) $m['month'][0], isset($m['year']) && $m['year'][0] !== '' ? (int) $m['year'][0] : null),
            'phrase' => $m[0][0],
            'offset' => $m[0][1],
        ], $matches);
    }

    /**
     * "26 Oct", "Oct 26", "26 tháng 10".
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function namedDates(string $text, NoteContext $context): array
    {
        $day = '(?:(?:'.NoteVocabulary::phrases('date_day_word').')\s+)?(?<day>\d{1,2})';
        $patterns = ['~(?<![\p{L}\p{N}])'.$day.'\s+(?:'.NoteVocabulary::phrases('month_word').')\s+(?<month>\d{1,2})(?![\p{L}\p{N}])~iu' => null];
        foreach (NoteVocabulary::family('month') as $month => $names) {
            $patterns['~(?<![\p{L}\p{N}])(?:'.$day.'\s+(?:'.$names.')|(?:'.$names.')\s+(?<dayAfter>\d{1,2}))(?![\p{L}\p{N}])~iu'] = (int) $month;
        }
        $found = [];
        foreach ($patterns as $pattern => $month) {
            preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
            foreach ($matches as $m) {
                $dayNumber = ($m['day'][0] ?? '') !== '' ? (int) $m['day'][0] : (int) $m['dayAfter'][0];
                $found[] = ['date' => $this->explicitDate($context, $dayNumber, $month ?? (int) $m['month'][0], null), 'phrase' => $m[0][0], 'offset' => $m[0][1]];
            }
        }

        return $found;
    }

    /** Null when the numbers are no real date ("31/2"). */
    /**
     * "ngày 28": that day this month, or next month once it has passed. Not "mỗi ngày", "ngày 2 lần".
     *
     * @return list<array{date: ?string, phrase: string, offset: int}>
     */
    private function daysOfMonth(string $text, NoteContext $context): array
    {
        $notFollowedBy = NoteVocabulary::phrases('date_separator').'|'.NoteVocabulary::phrases('month_word').'|'.NoteVocabulary::phrases('count_word');
        $pattern = '~(?<![\p{L}\p{N}])(?:'.NoteVocabulary::phrases('date_day_word').')\s+(?<day>\d{1,2})(?![\p{N}])(?!\s*(?:'.$notFollowedBy.')(?![\p{L}]))~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        $found = [];
        foreach ($matches as $m) {
            if ($this->endsWith(substr($text, 0, $m[0][1]), 'repeat_prefix') === null) {
                $found[] = ['date' => $this->nextDayOfMonth($context, (int) $m['day'][0]), 'phrase' => $m[0][0], 'offset' => $m[0][1]];
            }
        }

        return $found;
    }

    /** The next date with this day number, today included; null when no month has it ("ngày 32"). */
    private function nextDayOfMonth(NoteContext $context, int $day): ?string
    {
        $today = $context->today();
        $firstOfMonth = $today->modify('first day of this month');
        for ($ahead = 0; $ahead <= self::MONTHS_TO_FIND_A_DAY; $ahead++) {
            $month = $firstOfMonth->modify('+'.$ahead.' months');
            [$year, $monthNumber] = [(int) $month->format('Y'), (int) $month->format('n')];
            if (checkdate($monthNumber, $day, $year) && $month->setDate($year, $monthNumber, $day) >= $today) {
                return $month->setDate($year, $monthNumber, $day)->format('Y-m-d');
            }
        }

        return null;
    }

    private function explicitDate(NoteContext $context, int $day, int $month, ?int $explicitYear): ?string
    {
        $today = $context->today();
        $year = $explicitYear ?? (int) $today->format('Y');
        if (! checkdate($month, $day, $year)) {
            return null;
        }
        $date = $today->setDate($year, $month, $day);
        // NU-E4: a yearless date up to the grace period ago stays (the task is overdue); older means next year.
        $graceDays = (int) config('notes.overdue_grace_days');
        if ($explicitYear === null && $date < $today->modify('-'.$graceDays.' days')) {
            if (! checkdate($month, $day, $year + 1)) {
                return null;
            }
            $date = $date->setDate($year + 1, $month, $day);
        }

        return $date->format('Y-m-d');
    }

    private function daysUntil(int $fromWeekday, int $toWeekday): int
    {
        return ($toWeekday - $fromWeekday + self::DAYS_PER_WEEK) % self::DAYS_PER_WEEK;
    }

    private function daysFromToday(NoteContext $context, int $days): string
    {
        return $context->today()->modify('+'.$days.' days')->format('Y-m-d');
    }

    /** The phrase of $category that ends $text (followed by spaces), or null. */
    private function endsWith(string $text, string $category): ?string
    {
        return preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases($category).')\s+$~iu', $text, $m) === 1 ? $m[0] : null;
    }
}
