<?php

declare(strict_types=1);

namespace App\Services\Notes;

final class NoteTimeParser
{
    /** @return array{start: ?string, end: ?string, phrase: string, low: bool} */
    public function parse(string $text, NoteContext $context): array
    {
        $token = '\d{1,2}(?:[:.]\d{2}|h\d{0,2}|\s*giờ(?:\s*\d{2})?)?\s*(?:am|pm|sáng|chiều|tối)?';
        if (preg_match('~(?<!\d)(?:from\s+)?('.$token.')\s*(?:[-–]|\bto\b|đến)\s*('.$token.')(?!\d)~iu', $text, $m)) {
            $period = preg_match('/(am|pm|sáng|chiều|tối)/iu', $m[2], $p) ? $p[1] : null;
            $start = $this->time($m[1], $period);
            $end = $this->time($m[2]);

            return ['start' => $start, 'end' => $end !== null && $start !== null && $end > $start ? $end : null, 'phrase' => $m[0], 'low' => $start === null || $end === null];
        }
        $explicit = '(?:\d{1,2}(?:[:.]\d{2}|h\d{0,2}|\s*giờ(?:\s*\d{2})?)\s*(?:am|pm|sáng|chiều|tối)?|\d{1,2}\s*(?:am|pm)|at\s+\d{1,2})';
        if (preg_match('~(?<![\p{L}\p{N}])(?:lúc\s+)?('.$explicit.')(?![\p{L}\p{N}])~iu', $text, $m)) {
            $start = $this->time($m[1]);

            return ['start' => $start, 'end' => null, 'phrase' => $start === null ? '' : $m[0], 'low' => $start === null];
        }
        $defaults = ['tonight' => '20:00', 'tối nay' => '20:00', 'this evening' => '19:00', 'morning' => '09:00', 'sáng' => '09:00', 'noon' => '12:00', 'trưa' => '12:00', 'evening' => '19:00', 'chiều' => '15:00', 'tối' => '19:00'];
        foreach ($defaults as $word => $time) {
            if (preg_match(NoteVocabulary::pattern(preg_quote($word, '~')), $text)) {
                $dayBound = in_array($word, ['tonight', 'tối nay', 'this evening'], true);

                return ['start' => $dayBound && $time <= $context->local()->format('H:i') ? null : $time, 'end' => null, 'phrase' => $word, 'low' => false];
            }
        }

        return ['start' => null, 'end' => null, 'phrase' => '', 'low' => preg_match('/\d+(?:am|pm)\p{L}+/iu', $text) === 1];
    }

    private function time(string $text, ?string $inheritedPeriod = null): ?string
    {
        if (! preg_match('/(\d{1,2})(?:[:.h]\s*(\d{2})|\s*giờ(?:\s*(\d{2}))?)?\s*(am|pm|sáng|chiều|tối)?/iu', $text, $m)) {
            return null;
        }
        $hour = (int) $m[1];
        $minute = (int) (($m[2] ?? '') !== '' ? $m[2] : ($m[3] ?? 0));
        $period = mb_strtolower(($m[4] ?? '') ?: ($inheritedPeriod ?? ''));
        if ($hour > 23 || $minute > 59 || ($period !== '' && ($hour < 1 || $hour > 12))) {
            return null;
        }
        if (in_array($period, ['pm', 'chiều', 'tối'], true) && $hour < 12) {
            $hour += 12;
        } elseif (in_array($period, ['am', 'sáng'], true) && $hour === 12) {
            $hour = 0;
        } elseif ($period === '' && $hour >= 1 && $hour <= 6 && ! preg_match('/[:.h]|giờ/u', $text)) {
            $hour += 12;
        }

        return sprintf('%02d:%02d', $hour, $minute);
    }
}
