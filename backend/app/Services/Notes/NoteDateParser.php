<?php

declare(strict_types=1);

namespace App\Services\Notes;

/**
 * Reads an item's due date (NU §2.5). Every candidate keeps its byte offset and length, so the title can drop
 * exactly the words read, however date and time phrases overlap.
 *
 * @phpstan-type Candidate array{date: ?string, phrase: string, offset: int}
 */
final class NoteDateParser
{
    private const DAYS_PER_WEEK = 7;

    private const SATURDAY = 6;

    private const SUNDAY = 0;

    /** Enough months ahead to reach a 31st from any month. */
    private const MONTHS_TO_FIND_A_DAY = 2;

    /** Duration units this parser reads, in "+N <unit>" steps; minutes and hours belong to the time parser. */
    private const DATE_UNITS = ['day' => 'days', 'week' => 'weeks', 'month' => 'months'];

    public function __construct(private NoteDurations $durations) {}

    public function parse(string $text, NoteContext $context, ?string $startTime): ParsedDate
    {
        $unreadable = false;
        $best = null;
        foreach ($this->candidates($text, $context, $startTime) as $candidate) {
            $before = substr($text, 0, $candidate['offset']);
            if ($this->endsWith($before, NoteVocabulary::phrases('name_title')) !== null || $candidate['date'] === null) {
                // "chị Mai" may be a person, and "31/2" is no date: leave both to the LLM (NU-E31, ADR-008).
                $unreadable = true;

                continue;
            }
            $prefix = $this->endsWith($before, NoteVocabulary::phrases('date_preferred_prefix')) ?? '';
            $candidate = [...$candidate, 'preferred' => $prefix !== '', 'phrase' => $prefix.$candidate['phrase'], 'offset' => $candidate['offset'] - strlen($prefix)];
            $best = $best === null || $this->wins($candidate, $best) ? $candidate : $best;
        }

        return new ParsedDate($best['date'] ?? null, $best === null ? [] : [[$best['offset'], strlen($best['phrase'])]], $unreadable);
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

    /** @return list<Candidate> */
    private function candidates(string $text, NoteContext $context, ?string $startTime): array
    {
        return [
            ...$this->offsets($text, $context),
            ...$this->durationsFromToday($text, $context),
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
     * @return list<Candidate>
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
     * "in 3 days", "3 ngày nữa", "trong 2 tuần", "after 1 month".
     *
     * @return list<Candidate>
     */
    private function durationsFromToday(string $text, NoteContext $context): array
    {
        $found = [];
        foreach ($this->durations->findAll($text) as $duration) {
            $step = self::DATE_UNITS[$duration['unit']] ?? null;
            if ($step !== null) {
                $date = $context->today()->modify('+'.$duration['amount'].' '.$step)->format('Y-m-d');
                $found[] = ['date' => $date, 'phrase' => substr($text, $duration['offset'], $duration['length']), 'offset' => $duration['offset']];
            }
        }

        return $found;
    }

    /**
     * "next week" → the week's first day (NU-E10), "end of the week" → its last day, "weekend" → Saturday
     * (today on a weekend day), "end of the month" → its last day (NU-E9).
     *
     * @return list<Candidate>
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
     * @return list<Candidate>
     */
    private function weekdays(string $text, NoteContext $context, ?string $startTime): array
    {
        $today = (int) $context->today()->format('w');
        $found = [];
        foreach (NoteVocabulary::findAll('weekday', $text) as ['key' => $day, 'phrase' => $phrase, 'offset' => $offset]) {
            $before = substr($text, 0, $offset);
            $after = substr($text, $offset + strlen($phrase));
            $repeat = $this->endsWith($before, NoteVocabulary::phrases('repeat_prefix'));
            $thisPrefix = $this->endsWith($before, NoteVocabulary::phrases('weekday_this'));
            $next = $this->endsWith($before, NoteVocabulary::phrases('weekday_next'));
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
     * Numbers are day/month (NU-E31): "26/10", "ngày 26/10", and with a year "26/10/2026", "26.10.2026",
     * "26-10-2026", or year first "2026-10-26".
     *
     * @return list<Candidate>
     */
    private function numericDates(string $text, NoteContext $context): array
    {
        $dayWord = '(?:(?:'.NoteVocabulary::phrases('date_day_word').')\s+)?';
        $short = NoteVocabulary::phrases('date_separator');
        $full = NoteVocabulary::phrases('full_date_separator');
        $patterns = [
            '~(?<![\p{N}])'.$dayWord.'(?<day>\d{1,2})(?:'.$full.')(?<month>\d{1,2})(?:'.$full.')(?<year>\d{4})(?![\p{N}])~iu',
            '~(?<![\p{N}])(?<year>\d{4})(?:'.$full.')(?<month>\d{1,2})(?:'.$full.')(?<day>\d{1,2})(?![\p{N}])~iu',
            '~(?<![\p{N}])'.$dayWord.'(?<day>\d{1,2})(?:'.$short.')(?<month>\d{1,2})(?![\p{N}])(?!(?:'.$full.')\d)~iu',
        ];
        $found = [];
        foreach ($patterns as $pattern) {
            preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
            foreach ($matches as $m) {
                $year = ($m['year'][0] ?? '') !== '' ? (int) $m['year'][0] : null;
                $found[] = ['date' => $this->explicitDate($context, (int) $m['day'][0], (int) $m['month'][0], $year), 'phrase' => $m[0][0], 'offset' => $m[0][1]];
            }
        }

        return $found;
    }

    /**
     * "ngày 28", "mùng 5", "the 1st", "28th": that day this month, or next month once it has passed. Not
     * "mỗi ngày", "ngày 2 lần", and not a day that belongs to a named month ("Oct 1st", "1st of October").
     *
     * @return list<Candidate>
     */
    private function daysOfMonth(string $text, NoteContext $context): array
    {
        $months = implode('|', NoteVocabulary::family('month'));
        $notFollowedBy = implode('|', [
            NoteVocabulary::phrases('date_separator'), NoteVocabulary::phrases('full_date_separator'),
            NoteVocabulary::phrases('month_word'), NoteVocabulary::phrases('count_word'), NoteVocabulary::phrases('month_link'), $months,
        ]);
        $ordinal = NoteVocabulary::phrases('ordinal_suffix');
        $pattern = '~(?<![\p{L}\p{N}])(?:(?:'.NoteVocabulary::phrases('date_day_word').')\s+(?<day>\d{1,2})|(?:(?:'.NoteVocabulary::phrases('ordinal_day_word').')\s+)?(?<ordinalDay>\d{1,2})(?:'.$ordinal.'))'
            .'(?![\p{L}\p{N}])(?!\s*(?:'.$notFollowedBy.')(?![\p{L}]))~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        $found = [];
        foreach ($matches as $m) {
            $before = substr($text, 0, $m[0][1]);
            if ($this->endsWith($before, NoteVocabulary::phrases('repeat_prefix')) !== null || $this->endsWith($before, $months) !== null) {
                continue;
            }
            $day = ($m['day'][0] ?? '') !== '' ? $m['day'][0] : $m['ordinalDay'][0];
            $found[] = ['date' => $this->nextDayOfMonth($context, (int) $day), 'phrase' => $m[0][0], 'offset' => $m[0][1]];
        }

        return $found;
    }

    /**
     * Month-name dates with an optional year: "26 Oct", "26th of October 2026", "Oct 26, 2026",
     * "September 1st", "26 tháng 10", "26 tháng 9 năm 2026".
     *
     * @return list<Candidate>
     */
    private function namedDates(string $text, NoteContext $context): array
    {
        $dayWord = '(?:(?:'.NoteVocabulary::phrases('date_day_word').')\s+)?';
        $ordinal = '(?:'.NoteVocabulary::phrases('ordinal_suffix').')?';
        $link = '(?:(?:'.NoteVocabulary::phrases('month_link').')\s+)?';
        $year = '(?:\s*(?:'.NoteVocabulary::phrases('comma').')?\s*(?:(?:'.NoteVocabulary::phrases('year_word').')\s+)?(?<year>\d{4}))?';
        $edge = '(?![\p{L}\p{N}])';
        $patterns = ['~(?<![\p{L}\p{N}])'.$dayWord.'(?<day>\d{1,2})\s+(?:'.NoteVocabulary::phrases('month_word').')\s+(?<month>\d{1,2})'.$year.$edge.'~iu' => null];
        foreach (NoteVocabulary::family('month') as $month => $names) {
            $patterns['~(?<![\p{L}\p{N}])'.$dayWord.'(?<day>\d{1,2})'.$ordinal.'\s+'.$link.'(?:'.$names.')'.$year.$edge.'~iu'] = (int) $month;
            $patterns['~(?<![\p{L}\p{N}])(?:'.$names.')\s+(?<day>\d{1,2})'.$ordinal.$year.$edge.'~iu'] = (int) $month;
        }
        $found = [];
        foreach ($patterns as $pattern => $month) {
            preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
            foreach ($matches as $m) {
                $explicitYear = ($m['year'][0] ?? '') !== '' ? (int) $m['year'][0] : null;
                $date = $this->explicitDate($context, (int) $m['day'][0], $month ?? (int) $m['month'][0], $explicitYear);
                $found[] = ['date' => $date, 'phrase' => $m[0][0], 'offset' => $m[0][1]];
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

    /** Null when the numbers are no real date ("31/2"). */
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

    /** The phrase among $phrases that ends $text (followed by spaces), or null. */
    private function endsWith(string $text, string $phrases): ?string
    {
        return preg_match('~(?<![\p{L}\p{N}_])(?:'.$phrases.')\s+$~iu', $text, $m) === 1 ? $m[0] : null;
    }
}
