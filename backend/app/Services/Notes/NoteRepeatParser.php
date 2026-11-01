<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\Repeat;

/** Reads calendar repeat phrases; anything unresolved stays intact for fallback. */
final class NoteRepeatParser
{
    private const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    public function __construct(private NoteDateParser $dates) {}

    /** @return array{repeat: Repeat, spans: list<array{int, int}>, unreadable: bool, rule: ?string} */
    public function parse(string $text, NoteContext $context): array
    {
        $spans = [];
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
        $monthly = preg_match('~(?:of\s+(?:the\s+)?month|(?:every|each)\s+month|(?:mỗi|hàng|hằng)\s+tháng)~iu', $text) === 1 || $repeat === Repeat::Monthly;
        if ($monthly && preg_match($ordinalPattern, $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $day = NoteVocabulary::findAll('weekday', $m['day'][0])[0];
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== Repeat::Monthly);
            $repeat = Repeat::Monthly;
            $parts['BYDAY'] = $ordinals[mb_strtolower($m['ordinal'][0])].self::DAYS[(int) $day['key']];
            $spans[] = [$m[0][1], strlen($m[0][0])];
            if (preg_match('~(?:every\s+)?(?:of\s+(?:the\s+)?month)~iu', $text, $suffix, PREG_OFFSET_CAPTURE) === 1) {
                $spans[] = [$suffix[0][1], strlen($suffix[0][0])];
            }
            // "every second Monday of month" has its prefix before the ordinal.
            if (preg_match('~(?:every|each)\s+$~iu', substr($text, 0, $m[0][1]), $prefix, PREG_OFFSET_CAPTURE) === 1) {
                $spans[] = [$prefix[0][1], strlen($prefix[0][0])];
            }
        }
        $viOrdinal = ['đầu tiên' => 1, 'đầu' => 1, 'thứ nhất' => 1, 'thứ hai' => 2, 'thứ ba' => 3, 'thứ tư' => 4, 'thứ năm' => 5, 'cuối cùng' => -1, 'cuối' => -1];
        if ($monthly && ! isset($parts['BYDAY']) && preg_match('~(?<day>'.$weekdayPattern.')\s+(?<ordinal>'.implode('|', array_keys($viOrdinal)).')\s+(?:(?:của|trong)\s+)?(?:(?:mỗi|hàng|hằng)\s+)?tháng~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $day = NoteVocabulary::findAll('weekday', $m['day'][0])[0];
            $invalid = $invalid || ($repeat !== Repeat::Never && $repeat !== Repeat::Monthly);
            $repeat = Repeat::Monthly;
            $parts['BYDAY'] = $viOrdinal[mb_strtolower($m['ordinal'][0])].self::DAYS[(int) $day['key']];
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if ($monthly && preg_match('~(?:every\s+)?(?:last day|ngày cuối(?: cùng)?)(?:\s+(?:of|của|trong))?(?:\s+(?:the|every|mỗi|hàng|hằng))?\s+(?:month|tháng)~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            $invalid = $invalid || isset($parts['BYDAY']) || ! in_array($repeat, [Repeat::Never, Repeat::Monthly], true);
            $repeat = Repeat::Monthly;
            $parts['BYMONTHDAY'] = '-1';
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if ($repeat === Repeat::Monthly && preg_match('~(?:ngày|days?)\s+(\d{1,2}(?:(?:\s*,\s*|\s+(?:and|và)\s+)\d{1,2})*)(?![\d/])~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
            preg_match_all('/\d+/', $m[1][0], $numbers);
            $invalid = $invalid || isset($parts['BYDAY']) || isset($parts['BYMONTHDAY']);
            $parts['BYMONTHDAY'] = implode(',', array_unique($numbers[0]));
            $spans[] = [$m[0][1], strlen($m[0][0])];
        }
        if ($repeat === Repeat::Yearly) {
            foreach (NoteVocabulary::family('month') as $month => $names) {
                if (preg_match('~(?<!\p{L})(?:'.$names.')\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1
                    || preg_match('~(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:'.$names.')(?!\p{L})~iu', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
                    $parts['BYMONTH'] = (string) $month;
                    $parts['BYMONTHDAY'] = $m[1][0];
                    $spans[] = [$m[0][1], strlen($m[0][0])];
                    break;
                }
            }
            if (! isset($parts['BYMONTH']) && preg_match('~(?<![\d/])(?:ngày\s+)?(\d{1,2})/(\d{1,2})(?![\d/])~u', $text, $m, PREG_OFFSET_CAPTURE) === 1) {
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
            $numbersText = $text;
            foreach ($spans as [$offset, $length]) {
                $numbersText = substr_replace($numbersText, str_repeat(' ', $length), $offset, $length);
            }
            $numbersText = (string) preg_replace_callback('~(?:for|after|trong|sau)\s+\d+\s+(?:times?|occurrences?|lần)~iu', fn (array $m): string => str_repeat(' ', strlen($m[0])), $numbersText);
            $isRange = false;
            $days = NoteVocabulary::findAll('weekday', $text);
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
                && ($repeat === Repeat::Weekly || $hasPrefix) && preg_match('~(?<![\p{L}\p{N}:/-])(?:thứ\s*)?(?:[2-7]|cn|chủ nhật)(?:(?:\s*[, &-]\s*|\s+(?:và\s+)?)(?:thứ\s*)?(?:[2-7]|cn|chủ nhật))*(?![\p{L}\p{N}:/-])~iu', $numbersText, $m, PREG_OFFSET_CAPTURE) === 1) {
                preg_match_all('/[2-7]|cn|chủ nhật/iu', $m[0][0], $numbers);
                $invalid = $invalid || ! in_array($repeat, [Repeat::Never, Repeat::Weekly], true);
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
        if (isset($parts['BYDAY']) && str_contains($parts['BYDAY'], ',') && $repeat !== Repeat::Weekly) {
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
