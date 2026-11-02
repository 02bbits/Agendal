<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\Repeat;

/** Reads calendar repeat phrases; anything unresolved stays intact for fallback. */
final class NoteRepeatParser
{
    private const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

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
        $ordinal = 'first|second|third|fourth|fifth|last|[1-5](?:st|nd|rd|th)';
        $viOrdinal = 'đầu tiên|đầu|thứ nhất|thứ hai|thứ ba|thứ tư|thứ năm|cuối cùng|cuối';
        $day = '(?:(?:'.$ordinal.')\s+)?(?:'.$weekdays.')(?:\s+(?:'.$viOrdinal.'))?'
            .'|(?:(?:ngày|days?|the|thứ)\s+)?\d{1,2}(?:st|nd|rd|th)?';
        $joiner = '(?:\s*(?:'.NoteVocabulary::phrases('comma').')\s*(?:(?:and|và)\s+)?|\s+(?:and|và|&)\s+)';
        $pattern = '~(?<![\p{L}\p{N}:/-])(?:'.$day.')(?:'.$joiner.'(?:'.$day.'))+(?![\p{L}\p{N}:/-])~iu';
        preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE);
        $frequency = implode('|', NoteVocabulary::family('repeat'));
        $prefix = '(?:every\s+other|'.NoteVocabulary::phrases('repeat_prefix').'|'.$frequency.'|(?:every|mỗi)\s+\d+\s+(?:days?|weeks?|months?|years?|ngày|tuần|tháng|năm))';
        $link = '(?:on|vào|the|ngày|days?|thứ)';
        $spans = [];
        foreach ($matches[0] as [$list, $offset]) {
            $before = substr($text, 0, $offset);
            $after = substr($text, $offset + strlen($list));
            $hasPrefix = preg_match('~(?:'.$prefix.')\s+(?:(?:'.$link.')\s+)*$~iu', $before) === 1;
            $hasSuffix = preg_match('~^\s+(?:(?:of|của|trong)\s+)?(?:(?:the|every|each)\s+month|'.$frequency.')(?!\p{L})~iu', $after) === 1;
            // "Wednesday report" is another task; "Wednesday at 8am" still describes this schedule.
            $tail = (preg_split('~(?:'.NoteVocabulary::phrases('comma').'|'.NoteVocabulary::phrases('separator').')~u', $after, 2) ?: [''])[0];
            $tail = (string) preg_replace('~(?<!\d)\d{1,4}(?:'.NoteVocabulary::phrases('full_date_separator').')\d{1,2}(?:'.NoteVocabulary::phrases('full_date_separator').')\d{1,4}(?!\d)~u', '', $tail);
            $tail = (string) preg_replace('~^\s*(?:of\s+(?:the\s+)?month)(?!\p{L})~iu', '', $tail);
            $tail = (string) preg_replace('~^\s*(?:(?:'.NoteVocabulary::phrases('span_lead').'|'.NoteVocabulary::phrases('time_prefix').')\s+)+~iu', '', $tail);
            $tail = (string) preg_replace('~(?:for|after|trong|sau)\s+\d+\s+(?:times?|occurrences?|lần)(?!\p{L})~iu', '', $tail);
            $qualifier = preg_match('~^\s*(?:except|excluding|ngoại trừ|bỏ qua|never ends|không kết thúc|vô thời hạn)(?!\p{L})~iu', $tail) === 1;
            if (($hasPrefix || $hasSuffix) && ($qualifier || NoteVocabulary::onlyModifiers($tail))) {
                $spans[] = [$offset, strlen($list)];
            }
        }

        return $spans;
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

    /** @return array{repeat: Repeat, spans: list<array{int, int}>, unreadable: bool, rule: ?string, copies: int} */
    public function parse(string $text, NoteContext $context): array
    {
        $amounts = implode('|', NoteVocabulary::family('amount')).'|'.NoteVocabulary::phrases('amount_one');
        $pattern = '~(?<![\p{L}\p{N}.,/+\-])(?:(?<amount>\d+|'.$amounts.')\s+(?:times?|lần)|(?<adverb>once|twice))(?![\p{L}\p{N}])~iu';
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
            $count = is_numeric($word) ? (int) $word : (int) (NoteVocabulary::findAll('amount', $word)[0]['key'] ?? 1);
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

    /** @return array{repeat: Repeat, spans: list<array{int, int}>, unreadable: bool, rule: ?string} */
    private function read(string $text, NoteContext $context, bool $hasMultiplicity = false): array
    {
        $spans = [];
        // A weekday in an explicit end condition is an end date, not another selected weekday.
        // Vietnamese "đến thứ sáu" remains a weekday range; "đến ngày ..." marks an end.
        $scheduleText = $text;
        if (preg_match('~(?:until|ends? on|kết thúc(?: vào)?|(?:đến|tới)\s+(?=ngày|\d))(?:\s+ngày)?\s+.+$~iu', $text, $end, PREG_OFFSET_CAPTURE) === 1) {
            $scheduleText = substr_replace($scheduleText, str_repeat(' ', strlen($end[0][0])), $end[0][1], strlen($end[0][0]));
        }
        $named = NoteVocabulary::findAll('repeat', $text);
        $frequencies = array_unique(array_column($named, 'key'));
        $repeat = count($frequencies) === 1 ? Repeat::from($frequencies[0]) : Repeat::Never;
        $invalid = count($frequencies) > 1;
        $interval = 1;
        /** @var array<string, string> $parts */
        $parts = [];
        foreach ($named as $match) {
            $spans[] = [$match['offset'], strlen($match['phrase'])];
        }
        $units = ['day' => 'daily', 'days' => 'daily', 'ngày' => 'daily', 'week' => 'weekly', 'weeks' => 'weekly', 'tuần' => 'weekly', 'month' => 'monthly', 'months' => 'monthly', 'tháng' => 'monthly', 'year' => 'yearly', 'years' => 'yearly', 'năm' => 'yearly'];
        if ($hasMultiplicity && preg_match('~(?<![\p{L}\p{N}])(?:per\s+|each\s+|a\s+|/\s*)('.implode('|', array_keys($units)).')(?![\p{L}\p{N}])~iu', $text, $perPeriod, PREG_OFFSET_CAPTURE) === 1) {
            $frequency = Repeat::from($units[mb_strtolower($perPeriod[1][0])]);
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== $frequency);
            $repeat = $frequency;
            $spans[] = [$perPeriod[0][1], strlen($perPeriod[0][0])];
        }
        $intervalPattern = '~(?<![\p{L}\p{N}])(?:every|mỗi)\s+(\d+|other)\s+('.implode('|', array_keys($units)).')(?![\p{L}\p{N}])~iu';
        if (preg_match($intervalPattern, $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $interval = mb_strtolower($m[1][0]) === 'other' ? 2 : (int) $m[1][0];
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
        $ordinals = ['first' => 1, 'second' => 2, 'third' => 3, 'fourth' => 4, 'fifth' => 5, 'last' => -1, '1st' => 1, '2nd' => 2, '3rd' => 3, '4th' => 4, '5th' => 5];
        $ordinalPattern = '~(?<![\p{L}\p{N}])(?<ordinal>'.implode('|', array_keys($ordinals)).')\s+(?<day>'.$weekdayPattern.')(?![\p{L}\p{N}])~iu';
        $monthly = preg_match('~(?:of\s+(?:the\s+)?month|(?:every|each)\s+month|(?:mỗi|hàng|hằng)\s+tháng)~iu', $scheduleText) === 1 || $repeat === Repeat::Monthly;
        if ($monthly && preg_match_all($ordinalPattern, $scheduleText, $ordinalMatches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE) > 0) {
            $ordinalDays = [];
            foreach ($ordinalMatches as $m) {
                $day = NoteVocabulary::findAll('weekday', $m['day'][0])[0];
                $ordinalDays[] = $ordinals[mb_strtolower($m['ordinal'][0])].self::DAYS[(int) $day['key']];
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
        if ($repeat === Repeat::Monthly && preg_match('~(?<![\p{L}\p{N}])(?:ngày|days?|the)\s+(\d{1,2}(?:st|nd|rd|th)?(?:(?:\s*,\s*(?:(?:and|và)\s+)?|\s+(?:and|và)\s+)(?:(?:ngày|days?|the)\s+)?\d{1,2}(?:st|nd|rd|th)?)*)(?![\p{L}\p{N}/])~iu', $scheduleText, $m, PREG_OFFSET_CAPTURE) === 1) {
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
            return ['repeat' => $repeat, 'spans' => [], 'unreadable' => $invalid, 'rule' => null];
        }
        if ($repeat !== Repeat::Never) {
            if (preg_match('~(?:for|(?:ends?\s+)?after|trong|(?:kết thúc\s+)?sau)\s+(\d+)\s+(?:times?|occurrences?|lần)(?!\p{L})~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
                $parts['COUNT'] = $m[1][0];
                $spans[] = [$m[0][1], strlen($m[0][0])];
            }
            if (preg_match('~(?:until|ends? on|đến|tới|kết thúc(?: vào)?)(?:\s+ngày)?\s+(.+)$~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
                // A weekday range is part of BYDAY, not an end date.
                $covered = false;
                foreach ($spans as [$offset, $length]) {
                    $covered = $covered || ($offset <= $m[0][1] && $offset + $length >= $m[0][1] + strlen($m[0][0]));
                }
                if (! $covered) {
                    $until = $this->dates->parse($m[1][0], $context, null);
                    $invalid = $invalid || $until->date === null || $until->unreadable || isset($parts['COUNT']);
                    if ($until->date !== null) {
                        $parts['UNTIL'] = str_replace('-', '', $until->date).'T235959Z';
                    }
                    $spans[] = [$m[0][1], strlen($m[0][0])];
                }
            }
        }
        if (preg_match('~(?:never ends|không kết thúc|vô thời hạn)~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $invalid = $invalid || isset($parts['COUNT']) || isset($parts['UNTIL']);
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
            || NoteVocabulary::contains('repeat_prefix', $remaining)
            || preg_match('~\d[\d.,/+-]*\s+(?:times?|lần)(?!\p{L})~iu', $remaining) === 1
            || ($repeat === Repeat::Monthly && isset($parts['BYDAY']) && NoteVocabulary::findAll('weekday', $remaining) !== [])
            || preg_match('~(?<!\p{L})(?:except|excluding|ngoại trừ|bỏ qua|kết thúc|ends)(?!\p{L})~iu', $remaining) === 1
            || (isset($parts['COUNT']) && ((int) $parts['COUNT'] < 1 || (int) $parts['COUNT'] > 10000));
        if ($invalid) {
            return ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null];
        }
        $rule = 'FREQ='.strtoupper($repeat->value).';INTERVAL='.$interval.';WKST='.($context->weekStart->value === 'sun' ? 'SU' : 'MO');
        foreach ($parts as $key => $value) {
            $rule .= ';'.$key.'='.$value;
        }

        return ['repeat' => $repeat, 'spans' => $spans, 'unreadable' => false, 'rule' => $rule];
    }
}
