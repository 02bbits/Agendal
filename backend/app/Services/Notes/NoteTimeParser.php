<?php

declare(strict_types=1);

namespace App\Services\Notes;

final class NoteTimeParser
{
    /** NU-E7: a bare hour from 1 to this one means the afternoon ("at 2" → 14:00); 7–11 stay morning. */
    private const LAST_AFTERNOON_BARE_HOUR = 6;

    private const HALF_DAY = 12;

    /** Duration units this parser reads; days and longer belong to the date parser. */
    private const MINUTES_PER_UNIT = ['minute' => 1, 'hour' => 60];

    public function __construct(private NoteDurations $durations) {}

    public function parse(string $text, NoteContext $context): ParsedTime
    {
        // Compounds such as "tối ưu" are blanked with spaces, so every offset still points into $text.
        $readable = (string) preg_replace_callback(
            NoteVocabulary::pattern(NoteVocabulary::phrases('not_time_word')),
            fn (array $word): string => str_repeat(' ', strlen($word[0])),
            $text,
        );
        $relative = $this->relative($readable, $context);
        if ($relative !== null) {
            return $relative;
        }
        $dayPeriod = $this->dayPeriod($readable);
        $clock = $this->range($readable, $dayPeriod) ?? $this->clockTime($readable, $dayPeriod);
        if ($clock === null) {
            return $this->timeWord($readable, $context) ?? new ParsedTime(unreadable: $this->looksLikeTime($readable));
        }
        // "chiều mai 2-4h", "Monday morning 9am": the day-period words belong to the time, not the title.
        $wordSpans = array_map(fn (array $word): array => [$word['offset'], strlen($word['phrase'])], NoteVocabulary::findAll('time_word', $readable));

        return new ParsedTime($clock->start, $clock->end, [...$clock->spans, ...$wordSpans], $clock->unreadable);
    }

    /** "in 2 hours", "30 phút nữa": counted from when the note was written, which may be another day. */
    private function relative(string $text, NoteContext $context): ?ParsedTime
    {
        foreach ($this->durations->findAll($text) as $duration) {
            $perUnit = self::MINUTES_PER_UNIT[$duration['unit']] ?? null;
            if ($perUnit !== null) {
                $at = $context->local()->modify('+'.($duration['amount'] * $perUnit).' minutes');

                return new ParsedTime($at->format('H:i'), spans: [[$duration['offset'], $duration['length']]], date: $at->format('Y-m-d'));
            }
        }

        return null;
    }

    /** A standalone "chiều", "tối", "morning" gives am/pm to a time written without it ("tối 7-9h" → 19:00). */
    private function dayPeriod(string $text): string
    {
        return preg_match(NoteVocabulary::pattern($this->periods()), $text, $match) === 1 ? $match[0] : '';
    }

    /** NU-E30: "2-4pm", "14:00–16:00", "from 2 to 4". Plain number ranges ("pages 10-20") are not times. */
    private function range(string $text, string $dayPeriod): ?ParsedTime
    {
        $token = $this->token();
        $pattern = '~'.$this->notInDateBefore().'(?:(?<prefix>'.NoteVocabulary::phrases('range_prefix').')\s+)?(?<from>'.$token.')\s*(?:'.NoteVocabulary::phrases('range_separator').')\s*(?<to>'.$token.')'.$this->notInDateAfter().'~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        foreach ($matches as $match) {
            $from = $this->clock($match['from'][0], $dayPeriod);
            $to = $this->clock($match['to'][0], $dayPeriod);
            if ($match['prefix'][0] === '' && ! $from['marked'] && ! $to['marked']) {
                continue;
            }
            if (! $this->valid($from) || ! $this->valid($to)) {
                return new ParsedTime(unreadable: true);
            }
            $start = $this->startBefore($from, $to);
            $end = $this->format($to);

            return new ParsedTime($start, $end > $start ? $end : null, [[$match[0][1], strlen($match[0][0])]]);
        }

        return null;
    }

    /** "9am", "6:30pm", "14h", "9 giờ 30", "at 14". A number with no time marker is not a time. */
    private function clockTime(string $text, string $dayPeriod): ?ParsedTime
    {
        $pattern = '~'.$this->notInDateBefore().'(?:(?<prefix>'.NoteVocabulary::phrases('hour_prefix').')\s+)?(?<time>'.$this->token().')'.$this->notInDateAfter().'~iu';
        preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        foreach ($matches as $match) {
            $clock = $this->clock($match['time'][0], $dayPeriod);
            if (! $clock['marked'] && $match['prefix'][0] === '') {
                continue;
            }
            if (! $this->valid($clock)) {
                return new ParsedTime(unreadable: true);
            }

            return new ParsedTime($this->format($clock), spans: [[$match[0][1], strlen($match[0][0])]]);
        }

        return null;
    }

    /** "morning" (09:00), "tối nay" (20:00). Day-bound words written after their time keep no time (NU-E1). */
    private function timeWord(string $text, NoteContext $context): ?ParsedTime
    {
        $words = NoteVocabulary::findAll('time_word', $text);
        if ($words === []) {
            return null;
        }
        ['key' => $time, 'phrase' => $phrase] = $words[0];
        $passed = NoteVocabulary::contains('day_bound', $phrase) && $time <= $context->clock();
        $spans = array_map(fn (array $word): array => [$word['offset'], strlen($word['phrase'])], $words);

        return new ParsedTime($passed ? null : $time, spans: $spans);
    }

    /** A number joined to a date separator and digits belongs to a date ("2.11.2026", "2026-11-02"), not a time. */
    private function notInDateBefore(): string
    {
        $separators = array_map(fn (string $separator): string => '(?<!\d'.preg_quote($separator, '~').')', NoteVocabulary::values('full_date_separator'));

        return '(?<![\p{L}\p{N}])'.implode('', $separators);
    }

    private function notInDateAfter(): string
    {
        return '(?![\p{L}\p{N}])(?!(?:'.NoteVocabulary::phrases('full_date_separator').')\d)';
    }

    private function token(): string
    {
        return '\d{1,2}(?:(?:'.NoteVocabulary::phrases('minute_separator').')\d{2}|\s*(?:'.NoteVocabulary::phrases('hour_suffix').')(?:\s*\d{2})?)?(?:\s*(?:'.$this->periods().'))?';
    }

    private function periods(): string
    {
        return NoteVocabulary::phrases('period_am').'|'.NoteVocabulary::phrases('period_pm');
    }

    /** @return array{hour: int, minute: int, period: string, bare: bool, marked: bool} */
    private function clock(string $token, string $dayPeriod): array
    {
        $pattern = '~^(?<hour>\d{1,2})(?:(?:'.NoteVocabulary::phrases('minute_separator').')(?<minute>\d{2})|\s*(?<suffix>'.NoteVocabulary::phrases('hour_suffix').')(?:\s*(?<suffixMinute>\d{2}))?)?(?:\s*(?<period>'.$this->periods().'))?$~iu';
        preg_match($pattern, trim($token), $m);
        $hour = (int) ($m['hour'] ?? 0);
        $hasMinutes = ($m['minute'] ?? '') !== '' || ($m['suffixMinute'] ?? '') !== '';
        $ownPeriod = $m['period'] ?? '';
        // A 24-hour time ("chiều nay lúc 14h") already says which half of the day it is.
        $period = $ownPeriod !== '' ? $ownPeriod : ($hour <= self::HALF_DAY ? $dayPeriod : '');

        return [
            'hour' => $hour,
            'minute' => (int) (($m['minute'] ?? '') ?: ($m['suffixMinute'] ?? 0)),
            'period' => $period,
            // NU-E7 reads only an hour with no marker at all ("at 2", "lúc 2"); "6h" and "6 giờ" mean 06:00.
            'bare' => ! $hasMinutes && $period === '' && ($m['suffix'] ?? '') === '',
            'marked' => $hasMinutes || ($m['suffix'] ?? '') !== '' || $ownPeriod !== '',
        ];
    }

    /** @param array{hour: int, minute: int, period: string, bare: bool, marked: bool} $clock */
    private function valid(array $clock): bool
    {
        if ($clock['hour'] > 23 || $clock['minute'] > 59) {
            return false;
        }

        return $clock['period'] === '' || ($clock['hour'] >= 1 && $clock['hour'] <= self::HALF_DAY);
    }

    /**
     * A start without am/pm takes the end's ("2-4pm"), unless that puts it after the end ("10-2pm" → 10:00).
     *
     * @param  array{hour: int, minute: int, period: string, bare: bool, marked: bool}  $from
     * @param  array{hour: int, minute: int, period: string, bare: bool, marked: bool}  $to
     */
    private function startBefore(array $from, array $to): string
    {
        if ($from['period'] !== '' || $to['period'] === '') {
            return $this->format($from);
        }
        $shared = $this->format([...$from, 'period' => $to['period']]);

        return $shared < $this->format($to) ? $shared : $this->format($from);
    }

    /** @param array{hour: int, minute: int, period: string, bare: bool, marked: bool} $clock */
    private function format(array $clock): string
    {
        $hour = $clock['hour'];
        if ($clock['period'] !== '') {
            $afternoon = NoteVocabulary::contains('period_pm', $clock['period']);
            $hour = $hour % self::HALF_DAY + ($afternoon ? self::HALF_DAY : 0);
        } elseif ($clock['bare'] && $hour >= 1 && $hour <= self::LAST_AFTERNOON_BARE_HOUR) {
            $hour += self::HALF_DAY;
        }

        return sprintf('%02d:%02d', $hour, $clock['minute']);
    }

    /** "3pmish": a time-like token the rules can't read makes the item low confidence. */
    private function looksLikeTime(string $text): bool
    {
        return preg_match('~\d\s*(?:'.$this->periods().')\p{L}~iu', $text) === 1;
    }
}
