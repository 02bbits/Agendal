<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\Repeat;

/** Reads calendar repeat phrases; anything unresolved stays intact for fallback. */
final class NoteRepeatParser
{
    private const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    private const FREQUENCY_UNITS = ['day' => 'daily', 'days' => 'daily', 'ngày' => 'daily', 'week' => 'weekly', 'weeks' => 'weekly', 'tuần' => 'weekly', 'month' => 'monthly', 'months' => 'monthly', 'tháng' => 'monthly', 'year' => 'yearly', 'years' => 'yearly', 'năm' => 'yearly', 'wk' => 'weekly', 'wks' => 'weekly', 'mo' => 'monthly', 'mos' => 'monthly', 'yr' => 'yearly', 'yrs' => 'yearly'];

    /** The calendar unit a duration bound ("for 3 months") adds, by the frequency its unit word names. */
    private const BOUND_UNITS = ['daily' => 'day', 'weekly' => 'week', 'monthly' => 'month', 'yearly' => 'year'];

    private const WEEKS_PER_FORTNIGHT = 2;

    private const ORDINALS = ['first' => 1, 'second' => 2, 'third' => 3, 'fourth' => 4, 'fifth' => 5, 'last' => -1, '1st' => 1, '2nd' => 2, '3rd' => 3, '4th' => 4, '5th' => 5];

    public function __construct(private NoteDateParser $dates) {}

    /**
     * Calendar lists are one modifier, even before the frequency ("1, 15, 25 hàng tháng").
     * The splitter uses these same lexical boundaries before deciding which commas end a task.
     *
     * @return list<array{int, int}>
     */
    public static function listSpans(string $text): array
    {
        $weekdays = implode('|', NoteVocabulary::family('weekday'));
        $ordinal = implode('|', array_keys(self::ORDINALS));
        $viOrdinal = 'đầu tiên|đầu|thứ nhất|thứ hai|thứ ba|thứ tư|thứ năm|cuối cùng|cuối';
        $day = '(?:(?:'.$ordinal.')\s+)?(?:'.$weekdays.')(?:\s+(?:'.$viOrdinal.'))?'
            .'|(?:(?:ngày|days?|the|thứ)\s+)?\d{1,2}(?:st|nd|rd|th)?';
        $joiner = self::listJoiner();
        $ordinalList = '(?:'.$ordinal.')(?:'.$joiner.'(?:'.$ordinal.'))+\s+(?:'.$weekdays.')';
        $pattern = '~(?<![\p{L}\p{N}:/-])(?:(?:'.$day.')(?:'.$joiner.'(?:'.$day.'))+|'.$ordinalList.')(?![\p{L}\p{N}:/-])~iu';
        preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE);
        $frequency = implode('|', NoteVocabulary::family('repeat'));
        $prefix = '(?:every\s+other|'.NoteVocabulary::phrases('repeat_prefix').'|'.$frequency.'|(?:every|mỗi)\s+(?:'.NoteVocabulary::integerPattern().')\s+(?:'.implode('|', array_keys(self::FREQUENCY_UNITS)).'))';
        $link = '(?:on|vào|the|ngày|days?|thứ)';
        $spans = [];
        foreach ($matches[0] as [$list, $offset]) {
            $before = substr($text, 0, $offset);
            $after = substr($text, $offset + strlen($list));
            $hasPrefix = preg_match('~(?:'.$prefix.')\s+(?:(?:'.$link.')\s+)*$~iu', $before) === 1;
            $hasSuffix = preg_match('~^\s+(?:(?:of|của|trong)\s+)?(?:(?:the|every|each)\s+month|'.$frequency.')(?!\p{L})~iu', $after) === 1;
            // "Wednesday report" is another task; "Wednesday at 8am" still describes this schedule.
            $comma = NoteVocabulary::phrases('comma');
            $tail = (preg_split('~(?<!\d)(?:'.$comma.')|(?:'.$comma.')(?!\d)|(?:'.NoteVocabulary::phrases('separator').')~u', $after, 2) ?: [''])[0];
            $fullTail = $tail;
            $tail = (string) preg_replace('~(?<!\d)\d{1,4}(?:'.NoteVocabulary::phrases('full_date_separator').')\d{1,2}(?:'.NoteVocabulary::phrases('full_date_separator').')\d{1,4}(?!\d)~u', '', $tail);
            $tail = (string) preg_replace('~^\s*(?:of\s+(?:the\s+)?month)(?!\p{L})~iu', '', $tail);
            $tail = (string) preg_replace('~^\s*(?:(?:'.NoteVocabulary::phrases('span_lead').'|'.NoteVocabulary::phrases('time_prefix').')\s+)+~iu', '', $tail);
            $tail = (string) preg_replace('~(?:for|after|trong|sau)\s+\d+\s+(?:times?|occurrences?|lần)(?!\p{L})~iu', '', $tail);
            // "at least 3 weeks" keeps its "at": the tail is checked as written too. A tail that says how long in any
            // way keeps the list whole, so the schedule is read (or kept for review) in full rather than cut to one day.
            $qualifier = self::startsQualifier($tail) || self::onlyDurationAndModifiers($tail) || self::hasDurationShape($fullTail);
            if (($hasPrefix || $hasSuffix) && $qualifier) {
                $spans[] = [$offset, strlen($list)];
            }
        }

        return $spans;
    }

    private static function listJoiner(): string
    {
        return '(?:\s*(?:'.NoteVocabulary::phrases('comma').')\s*(?:(?:and|và)\s+)?|\s+(?:and|và|&)\s+)';
    }

    /** Count/end modifiers have the same lexical boundaries in the splitter and classifier. */
    public static function modifierExpression(): string
    {
        $count = '(?:'.NoteVocabulary::integerPattern().')\s+(?:times?|occurrences?|lần)';
        $prefix = '(?:'.NoteVocabulary::phrases('repeat_prefix').'|(?:ends?\s+)?after|for|trong|(?:kết thúc\s+)?sau)';

        $interval = '(?:every|mỗi)\s+(?:other|'.NoteVocabulary::integerPattern().')\s+(?:'.implode('|', array_keys(self::FREQUENCY_UNITS)).')';

        return '(?<![\p{L}\p{N}])(?:'.$interval.'|(?:(?:'.$prefix.')\s+)?(?:'.$count.'|once|twice))(?![\p{L}\p{N}])'
            .'|'.self::rollingBoundExpression(false).'|'.self::periodBoundExpression(false);
    }

    /** Units a duration bound counts in: the frequency units and "fortnight". */
    private static function boundUnits(): string
    {
        return implode('|', array_keys(self::FREQUENCY_UNITS)).'|'.NoteVocabulary::phrases('bound_fortnight');
    }

    /**
     * Any written amount, whole or not: "3", "4" in "4tuần", "1.5", "three", "half a". Only a whole number makes a
     * bound; the rest is read so that it is refused rather than left behind.
     */
    private static function amountExpression(): string
    {
        return '(?:\d+(?:[.,]\d+)?|'.NoteVocabulary::phrases('amount_half').'|'.NoteVocabulary::integerPattern().')'
            .'(?:\s+(?:'.NoteVocabulary::phrases('duration_fraction_suffix').'))?';
    }

    /** Words that end a series through the end of a period: "through next week", "đến hết tuần". */
    private static function endLeads(): string
    {
        return NoteVocabulary::phrases('bound_through_lead').'|'.NoteVocabulary::phrases('bound_until_lead');
    }

    /**
     * Whether an end word ("until", "through", "đến hết") was left out of every phrase read: "through next week until
     * Friday" reads one end, and the other must not be taken for a start.
     *
     * @param  list<array{int, int}>  $spans
     */
    private static function hasUnreadEnd(string $text, array $spans): bool
    {
        preg_match_all('~(?<![\p{L}\p{N}])(?:'.NoteVocabulary::phrases('bound_end_word').')(?![\p{L}\p{N}])~iu', $text, $matches, PREG_OFFSET_CAPTURE);
        foreach ($matches[0] as [$_, $at]) {
            $read = false;
            foreach ($spans as [$offset, $length]) {
                $read = $read || ($offset <= $at && $at < $offset + $length);
            }
            if (! $read) {
                return true;
            }
        }

        return false;
    }

    /** Words before an end date: "until Friday", "till 20/12", "through 2026-12-31", "đến ngày 15", "kết thúc vào". */
    private static function endDateLeads(): string
    {
        return 'ends? on|kết thúc(?: vào)?|'.self::endLeads();
    }

    /**
     * How long a series runs, read loosely: "for 3 months", "trong 4tuần liền", "for 3 more weeks", "for the next
     * week", and also "for about 3 weeks", "for several weeks", "trong 3 ngày rưỡi", which bounds() refuses. "in 4 weeks"
     * and "4 tuần nữa" move the start instead, so a following duration suffix rules the phrase out.
     */
    private static function rollingBoundExpression(bool $named): string
    {
        $group = fn (string $name): string => $named ? '(?<'.$name.'>' : '(?:';

        return '(?<![\p{L}\p{N}])(?:'.$group('next').NoteVocabulary::phrases('bound_lead_next').')|'.$group('lead').NoteVocabulary::phrases('bound_lead').'))'
            .'(?:\s+'.$group('approx').NoteVocabulary::phrases('bound_approximate').'))?'
            .'(?:\s+'.$group('amount').self::amountExpression().'))?(?:\s+(?:'.NoteVocabulary::phrases('bound_more').'))?'
            .'\s*(?<![\p{L}])'.$group('unit').self::boundUnits().')(?![\p{L}\p{N}])'
            .'(?:\s+'.$group('fraction').NoteVocabulary::phrases('duration_fraction_suffix').')(?![\p{L}\p{N}]))?'
            .'(?:\s*(?:'.NoteVocabulary::phrases('comma').'|\s(?:'.NoteVocabulary::phrases('list_joiner').'))?\s+'.$group('extra').'(?:'.self::amountExpression().')\s*(?<![\p{L}])'
            .'(?:'.self::boundUnits().'|'.implode('|', NoteVocabulary::family('duration_unit')).'))(?![\p{L}\p{N}]))?'
            .'(?:\s+(?:'.NoteVocabulary::phrases('bound_trail').')(?![\p{L}\p{N}]))?'
            .'(?:(?:\s+|-)'.$group('roughly').NoteVocabulary::phrases('bound_approximate_suffix').')(?![\p{L}\p{N}]))?'
            .'(?:\s+'.$group('start').NoteVocabulary::phrases('duration_suffix').')(?!\p{L}))?';
    }

    /** A calendar period the series runs in: "this week", "trong tháng này", "through next week", "đến hết tuần". */
    private static function periodBoundExpression(bool $named): string
    {
        $group = fn (string $name): string => $named ? '(?<'.$name.'>' : '(?:';
        $leads = NoteVocabulary::phrases('bound_lead').'|'.self::endLeads();

        return '(?<![\p{L}\p{N}])(?:'.$group('lead').$leads.')\s+)?'.$group('period').implode('|', NoteVocabulary::family('bound_period')).')(?![\p{L}\p{N}])';
    }

    /**
     * Every duration bound in $text with its byte offset and length: ['amount' => 6, 'unit' => 'week'] for "for 3
     * fortnights", ['period' => 'week', 'offset' => 1, 'through' => false] for "next week" (true for "through next
     * week": from now to its end), null for one that cannot be read exactly
     * ("for about 3 weeks", "for 1.5 months", "trong 3 ngày rưỡi").
     *
     * @return list<array{0: array{amount: int, unit: string}|array{period: string, offset: int, through: bool}|null, 1: int, 2: int}>
     */
    private static function bounds(string $text): array
    {
        $bounds = [];
        preg_match_all('~'.self::rollingBoundExpression(true).'~iu', $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        foreach ($matches as $m) {
            // "trong 2 tuần nữa" moves the start (the date parser reads it); "for 3 months from now" says both.
            $lead = mb_strtolower($m['lead'][0] ?? '');
            $startSuffix = ($m['start'][0] ?? '') !== '';
            if ($startSuffix && preg_match('~^(?:'.NoteVocabulary::phrases('duration_prefix').')$~iu', $lead) === 1) {
                continue;
            }
            $amountText = mb_strtolower($m['amount'][0] ?? '');
            $loose = ($m['approx'][0] ?? '') !== '' || ($m['fraction'][0] ?? '') !== '' || ($m['roughly'][0] ?? '') !== '' || ($m['extra'][0] ?? '') !== '';
            // "mỗi ngày trong tuần", "for tuần sau": a lead and a unit with no amount say nothing about how long.
            if ($amountText === '' && ! $loose && ($m['next'][0] ?? '') === '') {
                continue;
            }
            // Not an exact whole amount of one unit: kept for review ("3 days and 12 hours", "for 3 months from now").
            $approximate = $loose || $startSuffix;
            $amount = $amountText === '' ? 1 : NoteVocabulary::integer($amountText);
            $unitText = mb_strtolower($m['unit'][0]);
            $bound = match (true) {
                $approximate || $amount === null || ($amountText === '' && ($m['next'][0] ?? '') === '') => null,
                isset(self::FREQUENCY_UNITS[$unitText]) => ['amount' => $amount, 'unit' => self::BOUND_UNITS[self::FREQUENCY_UNITS[$unitText]]],
                default => ['amount' => $amount * self::WEEKS_PER_FORTNIGHT, 'unit' => self::BOUND_UNITS['weekly']],
            };
            $bounds[] = [$bound, $m[0][1], strlen($m[0][0])];
        }
        preg_match_all('~'.self::periodBoundExpression(true).'~iu', $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        $rolling = $bounds;
        foreach ($matches as $m) {
            // "next week" inside "for the next week" or "tuần tới" inside "trong 2 tuần tới" is part of that bound.
            foreach ($rolling as [$_, $offset, $length]) {
                if ($m[0][1] < $offset + $length && $offset < $m[0][1] + strlen($m[0][0])) {
                    continue 2;
                }
            }
            foreach (NoteVocabulary::family('bound_period') as $key => $phrases) {
                if (preg_match('~^(?:'.$phrases.')$~iu', $m['period'][0]) !== 1) {
                    continue;
                }
                [$period, $offset] = explode(':', $key);
                $lead = $m['lead'][0] ?? '';
                $through = $lead !== '' && preg_match('~^(?:'.NoteVocabulary::phrases('bound_through_lead').')$~iu', $lead) === 1;
                $untilLead = $lead !== '' && preg_match('~^(?:'.NoteVocabulary::phrases('bound_until_lead').')$~iu', $lead) === 1;
                $startLead = preg_match('~(?<![\p{L}\p{N}])(?:'.NoteVocabulary::phrases('bound_start_lead').')\s+$~iu', substr($text, 0, $m[0][1])) === 1;
                // "from next week" only starts the series; "until next week" is an end date, read with the other end dates.
                if (! $startLead && ! ($untilLead && $offset !== '0')) {
                    $bounds[] = [['period' => $period, 'offset' => (int) $offset, 'through' => $through], $m[0][1], strlen($m[0][0])];
                }
                break;
            }
        }

        return $bounds;
    }

    /**
     * An amount of a unit, however written, with what may follow it: "3 weeks", "4tuần", "2,5 tuần", "3 ngày rưỡi",
     * "3 weeks or so". Not a date ("15 tháng 11", "năm 2027").
     */
    private static function amountShapeExpression(): string
    {
        $tail = '(?:\s+(?:'.NoteVocabulary::phrases('duration_fraction_suffix').'|'.NoteVocabulary::phrases('bound_trail').')(?![\p{L}\p{N}]))*'
            .'(?:(?:\s+|-)(?:'.NoteVocabulary::phrases('bound_approximate_suffix').')(?![\p{L}\p{N}]))?';

        return '(?<![\p{L}\p{N}])(?:(?:'.NoteVocabulary::phrases('bound_approximate').')\s+)?(?:'.self::amountExpression().')\s*(?<![\p{L}])'
            .'(?:'.self::boundUnits().')(?![\p{L}\p{N}])(?!\s*\d)'.$tail;
    }

    /**
     * Text shaped like an amount of time or a calendar period: an amount of a unit, a lead or an approximation before
     * a unit ("for several weeks", "trong vài tuần"), or a period ("next month").
     */
    private static function durationShapeExpression(): string
    {
        $leads = NoteVocabulary::phrases('bound_lead').'|'.NoteVocabulary::phrases('bound_lead_next').'|'.self::endLeads().'|'.NoteVocabulary::phrases('bound_approximate');

        return '(?:(?<![\p{L}\p{N}])(?:'.$leads.')\s+)?'.self::amountShapeExpression()
            .'|(?<![\p{L}\p{N}])(?:'.$leads.')\s+(?:\S+\s+){0,3}?(?:'.self::boundUnits().')(?![\p{L}\p{N}])'
            .'|(?<![\p{L}\p{N}])(?:'.implode('|', NoteVocabulary::family('bound_period')).')(?![\p{L}\p{N}])';
    }

    /**
     * Whether $text holds an amount of time or a period. A recurring item whose unread words still hold one has lost
     * part of its schedule, whatever the wording, so it is kept for review (#120).
     */
    public static function hasDurationShape(string $text): bool
    {
        return preg_match('~'.self::durationShapeExpression().'~iu', $text) === 1;
    }

    /**
     * A fragment that only qualifies the schedule before it: an exclusion, an end ("until Friday"), or how long it runs
     * ("for several weeks", "1.5 weeks"), so a comma before it does not cut the schedule short.
     */
    public static function startsQualifier(string $text): bool
    {
        $text = ltrim($text);
        if (NoteVocabulary::startsWith($text, 'repeat_exclusion')
            || preg_match('~^(?:kết thúc|ends? (?:after|on)|'.self::endLeads().')(?!\p{L})~iu', $text) === 1) {
            return true;
        }

        return preg_match('~^(?:'.self::durationShapeExpression().')~iu', $text) === 1 && self::onlyDurationAndModifiers($text);
    }

    /**
     * Nothing but amounts of time, periods, ends, date and repeat words, and joiners: "for 2 weeks and 3 days",
     * "for 2 weeks never ends". Whatever this lets through, the extractor reads or keeps for review.
     */
    private static function onlyDurationAndModifiers(string $text): bool
    {
        $rest = (string) preg_replace('~'.self::durationShapeExpression().'~iu', ' ', $text);
        $rest = trim((string) preg_replace('~(?<![\p{L}\p{N}])(?:'.NoteVocabulary::phrases('list_joiner').'|never ends|không kết thúc|vô thời hạn)(?![\p{L}\p{N}])~iu', ' ', $rest));

        return $rest === '' || NoteVocabulary::onlyModifiers($rest) || self::startsQualifier($rest);
    }

    /** @return array{string, int}|null */
    private function weekdayShorthand(string $readable, string $text): ?array
    {
        $pattern = '~(?<![\p{L}\p{N}:/-])(?:thứ\s*)?(?:[2-7]|cn|chủ nhật)(?:(?:\s*[, &-]\s*|\s+(?:và\s+)?)(?:thứ\s*)?(?:[2-7]|cn|chủ nhật))*(?![\p{L}\p{N}:/-])~iu';
        preg_match_all($pattern, $readable, $matches, PREG_OFFSET_CAPTURE);
        $prefix = NoteVocabulary::phrases('repeat_prefix').'|'.NoteVocabulary::phrases('repeat:weekly');
        foreach ($matches[0] as [$phrase, $offset]) {
            $before = substr($text, 0, $offset);
            $after = substr($text, $offset + strlen($phrase));
            if (preg_match('~(?:'.$prefix.')\s+(?:(?:on|vào)\s+)?$~iu', $before) === 1
                || preg_match('~^\s+(?:'.NoteVocabulary::phrases('repeat:weekly').')(?!\p{L})~iu', $after) === 1
                || preg_match('/thứ|chủ nhật|cn/iu', $phrase) === 1) {
                return [$phrase, $offset];
            }
        }

        return null;
    }

    /** @return array{repeat: Repeat, spans: list<array{int, int}>, unreadable: bool, rule: ?string, copies: int, bound?: array{amount: int, unit: string}|array{period: string, offset: int, through: bool}|null, boundSpans?: list<array{int, int}>} */
    public function parse(string $text, NoteContext $context): array
    {
        $amounts = NoteVocabulary::integerPattern();
        $pattern = '~(?<![\p{L}\p{N}.,/+\-])(?:(?<amount>'.$amounts.')\s+(?:times?|lần)|(?<adverb>once|twice))(?![\p{L}\p{N}])~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        $counts = [];
        $readable = $text;
        foreach ($matches as $match) {
            [$phrase, $offset] = $match[0];
            // An overall series end is not the number of tasks on each scheduled day.
            if (preg_match('~(?:for|after|trong|sau)\s+$~iu', substr($text, 0, $offset)) === 1) {
                continue;
            }
            $word = mb_strtolower($match['amount'][0]);
            $count = NoteVocabulary::integer($word) ?? 0;
            if (($match['adverb'][0] ?? '') !== '') {
                $count = mb_strtolower($match['adverb'][0]) === 'twice' ? 2 : 1;
            }
            $counts[] = [$count, $offset, strlen($phrase)];
            $readable = substr_replace($readable, str_repeat(' ', strlen($phrase)), $offset, strlen($phrase));
        }
        $result = $this->read($readable, $context, $counts !== []);
        if ($counts === []) {
            return [...$result, 'copies' => 1];
        }
        if ($result['repeat'] === Repeat::Never) {
            return [...$this->read($text, $context), 'copies' => 1];
        }
        $copies = $counts[0][0];
        if (count($counts) !== 1 || $copies < 1 || $copies > (int) config('notes.max_items')) {
            return ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null, 'copies' => 1];
        }
        foreach ($counts as [$_, $offset, $length]) {
            $result['spans'][] = [$offset, $length];
        }

        return [...$result, 'copies' => $copies];
    }

    /**
     * $bound is how long the series runs from its first date ("for 3 months") or the calendar period it runs in
     * ("this week"); FieldExtractor turns it into UNTIL once the first date is known. $boundSpans are its words, which
     * hold no time ("cả tháng sau" is no "3 tháng sau").
     *
     * @return array{repeat: Repeat, spans: list<array{int, int}>, unreadable: bool, rule: ?string, bound?: array{amount: int, unit: string}|array{period: string, offset: int, through: bool}|null, boundSpans?: list<array{int, int}>}
     */
    private function read(string $text, NoteContext $context, bool $hasMultiplicity = false): array
    {
        $spans = [];
        // A weekday in an explicit end condition is an end date, not another selected weekday.
        // Vietnamese "đến thứ sáu" remains a weekday range; "đến ngày ..." marks an end.
        $scheduleText = $text;
        if (preg_match('~(?:(?!(?:đến|tới)\s)(?:'.self::endDateLeads().')|(?:đến|tới)\s+(?=ngày|\d))(?:\s+ngày)?\s+.+$~iu', $text, $end, PREG_OFFSET_CAPTURE) === 1) {
            $scheduleText = substr_replace($scheduleText, str_repeat(' ', strlen($end[0][0])), $end[0][1], strlen($end[0][0]));
        }
        $named = NoteVocabulary::findAll('repeat', $text);
        $frequencies = array_unique(array_column($named, 'key'));
        $repeat = count($frequencies) === 1 ? Repeat::from($frequencies[0]) : Repeat::Never;
        $invalid = count($frequencies) > 1;
        $interval = 1;
        $bound = null;
        $boundSpans = [];
        /** @var array<string, string> $parts */
        $parts = [];
        foreach ($named as $match) {
            $spans[] = [$match['offset'], strlen($match['phrase'])];
        }
        $units = self::FREQUENCY_UNITS;
        if ($hasMultiplicity && preg_match('~(?<![\p{L}\p{N}])(?:per\s+|each\s+|a\s+|/\s*)('.implode('|', array_keys($units)).')(?![\p{L}\p{N}])~iu', $text, $perPeriod, PREG_OFFSET_CAPTURE) === 1) {
            $frequency = Repeat::from($units[mb_strtolower($perPeriod[1][0])]);
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== $frequency);
            $repeat = $frequency;
            $spans[] = [$perPeriod[0][1], strlen($perPeriod[0][0])];
        }
        $intervalPattern = '~(?<![\p{L}\p{N}])(?:every|mỗi)\s+('.NoteVocabulary::integerPattern().'|other)\s+('.implode('|', array_keys($units)).')(?![\p{L}\p{N}])~iu';
        if (preg_match($intervalPattern, $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $interval = mb_strtolower($m[1][0]) === 'other' ? 2 : (NoteVocabulary::integer($m[1][0]) ?? 0);
            $frequency = Repeat::from($units[mb_strtolower($m[2][0])]);
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== $frequency);
            $repeat = $frequency;
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if (preg_match('~cách\s+(ngày|tuần)~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $invalid = $invalid || $repeat !== Repeat::Never;
            $repeat = $m[1][0] === 'ngày' ? Repeat::Daily : Repeat::Weekly;
            $interval = 2;
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        $weekdayPattern = implode('|', NoteVocabulary::family('weekday'));
        $ordinal = implode('|', array_keys(self::ORDINALS));
        $ordinalPattern = '~(?<![\p{L}\p{N}])(?<ordinal>(?:'.$ordinal.')(?:'.self::listJoiner().'(?:'.$ordinal.'))*)\s+(?<day>'.$weekdayPattern.')(?![\p{L}\p{N}])~iu';
        $monthly = preg_match('~(?:of\s+(?:the\s+)?month|(?:every|each)\s+month|(?:mỗi|hàng|hằng)\s+tháng)~iu', $scheduleText) === 1 || $repeat === Repeat::Monthly;
        if ($monthly && preg_match_all($ordinalPattern, $scheduleText, $ordinalMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE) > 0) {
            $ordinalDays = [];
            foreach ($ordinalMatches as $m) {
                $day = NoteVocabulary::findAll('weekday', $m['day'][0])[0];
                preg_match_all(NoteVocabulary::pattern($ordinal), $m['ordinal'][0], $selectedOrdinals);
                foreach ($selectedOrdinals[0] as $selected) {
                    $ordinalDays[] = self::ORDINALS[mb_strtolower($selected)].self::DAYS[(int) $day['key']];
                }
                $spans[] = [$m[0][1], strlen($m[0][0])];
            }
            $m = $ordinalMatches[0];
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== Repeat::Monthly);
            $repeat = Repeat::Monthly;
            $parts['BYDAY'] = implode(',', array_unique($ordinalDays));
            if (preg_match('~(?:every\s+)?(?:of\s+(?:the\s+)?month)~iu', $scheduleText, $suffix, PREG_OFFSET_CAPTURE) === 1) {
                $spans[] = [$suffix[0][1], strlen($suffix[0][0])];
            }
            // "every second Monday of month" has its prefix before the ordinal.
            if (preg_match('~(?:every|each)\s+$~iu', substr($text, 0, $m[0][1]), $prefix, PREG_OFFSET_CAPTURE) === 1) {
                $spans[] = [$prefix[0][1], strlen($prefix[0][0])];
            }
        }
        $viOrdinal = ['đầu tiên' => 1, 'đầu' => 1, 'thứ nhất' => 1, 'thứ hai' => 2, 'thứ ba' => 3, 'thứ tư' => 4, 'thứ năm' => 5, 'cuối cùng' => -1, 'cuối' => -1];
        $viOrdinalPattern = '~(?<day>'.$weekdayPattern.')\s+(?<ordinal>'.implode('|', array_keys($viOrdinal)).')(?!\p{L})(?:\s+(?:(?:của|trong)\s+)?(?:(?:mỗi|hàng|hằng)\s+)?tháng)?~iu';
        if ($monthly && ! isset($parts['BYDAY']) && preg_match_all($viOrdinalPattern, $scheduleText, $ordinalMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE) > 0) {
            $ordinalDays = [];
            foreach ($ordinalMatches as $m) {
                $day = NoteVocabulary::findAll('weekday', $m['day'][0])[0];
                $ordinalDays[] = $viOrdinal[mb_strtolower($m['ordinal'][0])].self::DAYS[(int) $day['key']];
                $spans[] = [$m[0][1], strlen($m[0][0])];
            }
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== Repeat::Monthly);
            $repeat = Repeat::Monthly;
            $parts['BYDAY'] = implode(',', array_unique($ordinalDays));
        }
        if ($monthly && preg_match('~(?:every\s+)?(?:last day|ngày cuối(?: cùng)?)(?:\s+(?:of|của|trong))?(?:\s+(?:the|every|mỗi|hàng|hằng))?\s+(?:month|tháng)~iu', $scheduleText, $m, PREG_OFFSET_CAPTURE) === 1) {
            $invalid = $invalid || isset($parts['BYDAY']) || ! in_array($repeat, [Repeat::Never, Repeat::Monthly], true);
            $repeat = Repeat::Monthly;
            $parts['BYMONTHDAY'] = '-1';
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if ($repeat === Repeat::Monthly && preg_match('~(?<![\p{L}\p{N}])(?:(?:ngày|days?|the|on)\s+|(?=\d{1,2}(?:st|nd|rd|th)))(\d{1,2}(?:st|nd|rd|th)?(?:(?:\s*,\s*(?:(?:and|và)\s+)?|\s+(?:and|và)\s+)(?:(?:ngày|days?|the)\s+)?\d{1,2}(?:st|nd|rd|th)?)*)(?![\p{L}\p{N}/])~iu', $scheduleText, $m, PREG_OFFSET_CAPTURE) === 1) {
            preg_match_all('/\d+/', $m[1][0], $numbers);
            $invalid = $invalid || isset($parts['BYDAY']) || isset($parts['BYMONTHDAY']);
            $parts['BYMONTHDAY'] = implode(',', array_unique($numbers[0]));
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if ($repeat === Repeat::Yearly) {
            foreach (NoteVocabulary::family('month') as $month => $names) {
                if (preg_match('~(?<!\p{L})(?:'.$names.')\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)~iu', $scheduleText, $m, PREG_OFFSET_CAPTURE) === 1
                    || preg_match('~(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:'.$names.')(?!\p{L})~iu', $scheduleText, $m, PREG_OFFSET_CAPTURE) === 1) {
                    $parts['BYMONTH'] = (string) $month;
                    $parts['BYMONTHDAY'] = $m[1][0];
                    $spans[] = [$m[0][1], strlen($m[0][0])];
                    break;
                }
            }
            if (! isset($parts['BYMONTH']) && preg_match('~(?<![\d/])(?:ngày\s+)?(\d{1,2})/(\d{1,2})(?![\d/])~u', $scheduleText, $m, PREG_OFFSET_CAPTURE) === 1) {
                $parts['BYMONTH'] = $m[2][0];
                $parts['BYMONTHDAY'] = $m[1][0];
                $spans[] = [$m[0][1], strlen($m[0][0])];
            }
            if (isset($parts['BYMONTH'], $parts['BYMONTHDAY'])) {
                $invalid = $invalid || ! checkdate((int) $parts['BYMONTH'], (int) $parts['BYMONTHDAY'], 2000);
            }
        }
        $hasPrefix = NoteVocabulary::contains('repeat_prefix', $text);
        if (! isset($parts['BYDAY'])) {
            $numbersText = $scheduleText;
            foreach ($spans as [$offset, $length]) {
                $numbersText = substr_replace($numbersText, str_repeat(' ', $length), $offset, $length);
            }
            $numbersText = (string) preg_replace_callback('~(?:for|after|trong|sau)\s+\d+\s+(?:times?|occurrences?|lần)~iu', fn (array $m): string => str_repeat(' ', strlen($m[0])), $numbersText);
            // "mỗi thứ 3 2,5 tuần": the numbers of an amount of time are no weekdays.
            $numbersText = (string) preg_replace_callback('~'.self::amountShapeExpression().'~iu', fn (array $m): string => str_repeat(' ', strlen($m[0])), $numbersText);
            $isRange = false;
            $days = NoteVocabulary::findAll('weekday', $scheduleText);
            if (($hasPrefix || $repeat === Repeat::Weekly) && $days !== []) {
                $invalid = $invalid || ! in_array($repeat, [Repeat::Never, Repeat::Weekly], true);
                $repeat = $repeat === Repeat::Never ? Repeat::Weekly : $repeat;
                $parts['BYDAY'] = implode(',', array_unique(array_map(fn (array $day): string => self::DAYS[(int) $day['key']], $days)));
                $first = $days[0]['offset'];
                $last = $days[array_key_last($days)];
                foreach (array_slice($days, 1) as $index => $day) {
                    $previous = $days[$index];
                    $gap = substr($text, $previous['offset'] + strlen($previous['phrase']), $day['offset'] - $previous['offset'] - strlen($previous['phrase']));
                    $invalid = $invalid || preg_match('~^(?:\s|[,/&-]|and|và|to|through|đến|tới|[2-7])*$~iu', $gap) !== 1;
                }
                $spans[] = [$first, $last['offset'] + strlen($last['phrase']) - $first];
                if (preg_match('~(?:every\s+other|every|mỗi|lặp lại)\s+$~iu', substr($text, 0, $first), $prefix, PREG_OFFSET_CAPTURE) === 1) {
                    $spans[] = [$prefix[0][1], strlen($prefix[0][0])];
                    if (str_contains(mb_strtolower($prefix[0][0]), 'other')) {
                        $interval = 2;
                    }
                }
                if (count($days) === 2) {
                    $between = trim(substr($text, $first + strlen($days[0]['phrase']), $last['offset'] - $first - strlen($days[0]['phrase'])));
                    if (in_array(mb_strtolower($between), ['to', 'through', 'đến', 'tới', '-'], true)) {
                        $range = [(int) $days[0]['key']];
                        while (end($range) !== (int) $last['key']) {
                            $range[] = (end($range) + 1) % 7;
                        }
                        $parts['BYDAY'] = implode(',', array_map(fn (int $day): string => self::DAYS[$day], $range));
                        $isRange = true;
                    }
                }
            }
            // Vietnamese shorthand: "2 4 6 hàng tuần", "mỗi tuần thứ 2, 3, 5".
            if (! $isRange && ($days === [] || preg_match('/thứ|tuần|mỗi|lặp lại/iu', $text) === 1)
                && ($repeat === Repeat::Weekly || ($repeat === Repeat::Never && $hasPrefix)) && ($shorthand = $this->weekdayShorthand($numbersText, $text)) !== null) {
                $m = [0 => $shorthand];
                preg_match_all('/[2-7]|cn|chủ nhật/iu', $m[0][0], $numbers);
                $repeat = $repeat === Repeat::Never ? Repeat::Weekly : $repeat;
                $parts['BYDAY'] = implode(',', array_unique(array_map(fn (string $day): string => is_numeric($day) ? self::DAYS[(int) $day - 1] : 'SU', $numbers[0])));
                $spans[] = [$m[0][1], strlen($m[0][0])];
                if (preg_match('~mỗi\s+$~iu', substr($text, 0, $m[0][1]), $prefix, PREG_OFFSET_CAPTURE) === 1) {
                    $spans[] = [$prefix[0][1], strlen($prefix[0][0])];
                }
            }
        }
        if (preg_match('~(?:every\s+(?:weekday|weekend)|(?:mỗi|hằng|hàng)\s+(?:ngày làm việc|cuối tuần))s?~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $invalid = $invalid || ! in_array($repeat, [Repeat::Never, Repeat::Weekly], true);
            $repeat = Repeat::Weekly;
            $parts['BYDAY'] = preg_match('/weekend|cuối tuần/iu', $m[0][0]) === 1 ? 'SA,SU' : 'MO,TU,WE,TH,FR';
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if (isset($parts['BYDAY']) && str_contains($parts['BYDAY'], ',') && ! in_array($repeat, [Repeat::Weekly, Repeat::Monthly], true)) {
            $invalid = true;
        }
        if ($repeat === Repeat::Never && ! $hasPrefix) {
            return ['repeat' => $repeat, 'spans' => [], 'unreadable' => $invalid || NoteVocabulary::contains('repeat_unsupported', $text), 'rule' => null];
        }
        if ($repeat !== Repeat::Never) {
            if (preg_match('~(?:for|(?:ends?\s+)?after|trong|(?:kết thúc\s+)?sau)\s+('.NoteVocabulary::integerPattern().')\s+(?:times?|occurrences?|lần)(?!\p{L})~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
                $parts['COUNT'] = (string) (NoteVocabulary::integer($m[1][0]) ?? 0);
                $spans[] = [$m[0][1], strlen($m[0][0])];
            }
            // How long the series runs ("for 3 months", "this week"), not when it starts ("in 4 weeks", "4 tuần nữa").
            $bounds = self::bounds($text);
            if ($bounds !== []) {
                $bound = $bounds[0][0];
                $amount = $bound['amount'] ?? 1;
                $invalid = $invalid || $bound === null || count($bounds) > 1 || $amount < 1 || $amount > 999 || isset($parts['COUNT']);
                foreach ($bounds as [$_, $offset, $length]) {
                    $spans[] = [$offset, $length];
                    $boundSpans[] = [$offset, $length];
                }
            }
            if (preg_match('~(?:'.self::endDateLeads().')(?:\s+ngày)?\s+(.+)$~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
                // A weekday range is part of BYDAY and "through next week" a bound, not an end date.
                $covered = false;
                foreach ($spans as [$offset, $length]) {
                    $covered = $covered || ($offset <= $m[0][1] && $m[0][1] < $offset + $length);
                }
                if (! $covered) {
                    $until = $this->dates->parse($m[1][0], $context, null);
                    // "until Friday until Sunday": one end date only.
                    $invalid = $invalid || $until->date === null || $until->unreadable || isset($parts['COUNT']) || $bound !== null
                        || preg_match('~(?<![\p{L}\p{N}])(?:'.NoteVocabulary::phrases('bound_end_word').')(?![\p{L}\p{N}])~iu', $m[1][0]) === 1;
                    if ($until->date !== null) {
                        $parts['UNTIL'] = str_replace('-', '', $until->date).'T235959Z';
                    }
                    $spans[] = [$m[0][1], strlen($m[0][0])];
                }
            }
        }
        if (preg_match('~(?:never ends|không kết thúc|vô thời hạn)~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $invalid = $invalid || isset($parts['COUNT']) || isset($parts['UNTIL']) || $bound !== null;
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if (preg_match('~(?<!\p{L})(?:lặp lại|repeat)\s+~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        $remaining = $text;
        foreach ($spans as [$offset, $length]) {
            $remaining = substr_replace($remaining, str_repeat(' ', $length), $offset, $length);
        }
        $invalid = $invalid || $repeat === Repeat::Never || $interval < 1 || $interval > 999
            || self::hasUnreadEnd($text, $spans)
            || NoteVocabulary::contains('repeat_prefix', $remaining)
            || NoteVocabulary::contains('repeat_unsupported', $remaining)
            || preg_match('~\d[\d.,/+-]*\s+(?:times?|lần)(?!\p{L})~iu', $remaining) === 1
            || ($repeat === Repeat::Monthly && isset($parts['BYDAY']) && NoteVocabulary::findAll('weekday', $remaining) !== [])
            || NoteVocabulary::contains('repeat_exclusion', $remaining)
            || preg_match('~(?<!\p{L})(?:kết thúc|ends)(?!\p{L})~iu', $remaining) === 1
            || (isset($parts['COUNT']) && ((int) $parts['COUNT'] < 1 || (int) $parts['COUNT'] > 10000));
        if ($invalid) {
            return ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null];
        }
        $rule = 'FREQ='.strtoupper($repeat->value).';INTERVAL='.$interval.';WKST='.($context->weekStart->value === 'sun' ? 'SU' : 'MO');
        foreach ($parts as $key => $value) {
            $rule .= ';'.$key.'='.$value;
        }

        return ['repeat' => $repeat, 'spans' => $spans, 'unreadable' => false, 'rule' => $rule, 'bound' => $bound, 'boundSpans' => $boundSpans];
    }
}
