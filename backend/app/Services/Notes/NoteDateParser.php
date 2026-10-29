<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

final class NoteDateParser
{
    public const WEEKDAYS = 'monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun|thứ hai|thứ 2|t2|thứ ba|thứ 3|t3|thứ tư|thứ 4|t4|thứ năm|thứ 5|t5|thứ sáu|thứ 6|t6|thứ bảy|thứ 7|t7|chủ nhật|cn';

    /** @return array{date: ?string, phrase: string, low: bool} */
    public function parse(string $text, NoteContext $context, ?string $time): array
    {
        $today = $context->local()->setTime(0, 0);
        $matches = [];
        $phrases = 'day after tomorrow|ngày mốt|mốt|tomorrow|tmr|ngày mai|mai|today|hôm nay|tonight|this evening|tối nay|next week|tuần sau|tuần tới|end of the week|cuối tuần|end of the month|cuối tháng|in a week|in \d+ days|\d+ ngày nữa|(?:'.self::WEEKDAYS.')|\d{1,2}/\d{1,2}(?:/\d{4})?|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|tháng \d{1,2})|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}';
        preg_match_all(NoteVocabulary::pattern('(?:(?:by|due|on|before|next|this|every|mỗi|ngày|vào|trước)\s+)?(?:'.$phrases.')'), $text, $found, PREG_OFFSET_CAPTURE);
        $low = false;
        foreach ($found[0] as [$phrase, $position]) {
            $date = $this->resolve(mb_strtolower($phrase), $today, $context, $time);
            if ($date === null) {
                $low = true;

                continue;
            }
            $matches[] = ['date' => $date, 'phrase' => $phrase, 'preferred' => preg_match('/^(by|due|on|before|vào|trước)\s/iu', $phrase) === 1, 'position' => $position];
        }
        usort($matches, fn (array $a, array $b): int => ($b['preferred'] <=> $a['preferred']) ?: strcmp($b['date'], $a['date']) ?: ($a['position'] <=> $b['position']));

        return ['date' => $matches[0]['date'] ?? null, 'phrase' => $matches[0]['phrase'] ?? '', 'low' => $low];
    }

    private function resolve(string $phrase, DateTimeImmutable $today, NoteContext $context, ?string $time): ?string
    {
        $bare = (string) preg_replace('/^(by|due|on|before|vào|trước)\s+/iu', '', $phrase);
        if (in_array($bare, ['today', 'hôm nay', 'tonight', 'this evening', 'tối nay'], true)) {
            return $today->format('Y-m-d');
        }
        if (in_array($bare, ['tomorrow', 'tmr', 'ngày mai', 'mai', 'day after tomorrow', 'ngày mốt', 'mốt'], true)) {
            return $today->modify(in_array($bare, ['day after tomorrow', 'ngày mốt', 'mốt'], true) ? '+2 days' : '+1 day')->format('Y-m-d');
        }
        if (preg_match('/^(in (\d+) days|(\d+) ngày nữa|in a week)$/u', $bare, $m)) {
            return $today->modify('+'.($m[2] ?? ($m[3] ?? 7)).' days')->format('Y-m-d');
        }
        if (in_array($bare, ['end of the month', 'cuối tháng'], true)) {
            return $today->modify('last day of this month')->format('Y-m-d');
        }
        if (in_array($bare, ['next week', 'tuần sau', 'tuần tới', 'end of the week', 'cuối tuần'], true)) {
            $next = in_array($bare, ['next week', 'tuần sau', 'tuần tới'], true);
            $target = $next ? ($context->weekStart === 'sunday' ? 0 : 1) : ($context->weekStart === 'sunday' ? 6 : 0);
            $days = ($target - (int) $today->format('w') + 7) % 7;

            return $today->modify('+'.($next && $days === 0 ? 7 : $days).' days')->format('Y-m-d');
        }
        $weekday = (string) preg_replace('/^(next|this|every|mỗi)\s+/u', '', $bare);
        $groups = [1 => 'monday|mon|thứ hai|thứ 2|t2', 2 => 'tuesday|tue|thứ ba|thứ 3|t3', 3 => 'wednesday|wed|thứ tư|thứ 4|t4', 4 => 'thursday|thu|thứ năm|thứ 5|t5', 5 => 'friday|fri|thứ sáu|thứ 6|t6', 6 => 'saturday|sat|thứ bảy|thứ 7|t7', 0 => 'sunday|sun|chủ nhật|cn'];
        foreach ($groups as $day => $words) {
            if (in_array($weekday, explode('|', $words), true)) {
                $days = ($day - (int) $today->format('w') + 7) % 7;
                $repeatToday = preg_match('/^(every|mỗi) /u', $bare) && ($time === null || $time > $context->local()->format('H:i'));
                if ($days === 0 && ! str_starts_with($bare, 'this ') && ! $repeatToday) {
                    $days = 7;
                }

                return $today->modify('+'.$days.' days')->format('Y-m-d');
            }
        }
        $explicitYear = false;
        if (preg_match('~^(?:ngày )?(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$~u', $bare, $m)) {
            $day = (int) $m[1];
            $month = (int) $m[2];
            $explicitYear = isset($m[3]);
            $year = (int) ($m[3] ?? $today->format('Y'));
        } else {
            $months = array_flip(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']);
            if (preg_match('/^(\d{1,2}) (tháng (\d{1,2})|[a-z]{3})$/u', $bare, $m)) {
                $day = (int) $m[1];
                $month = isset($m[3]) ? (int) $m[3] : ($months[$m[2]] ?? -1) + 1;
            } elseif (preg_match('/^([a-z]{3}) (\d{1,2})$/u', $bare, $m)) {
                $day = (int) $m[2];
                $month = ($months[$m[1]] ?? -1) + 1;
            } else {
                return null;
            }
            $year = (int) $today->format('Y');
        }
        if (! checkdate($month, $day, $year)) {
            return null;
        }
        $date = $today->setDate($year, $month, $day);
        if (! $explicitYear && $date < $today->modify('-30 days')) {
            if (! checkdate($month, $day, $year + 1)) {
                return null;
            }
            $date = $date->setDate($year + 1, $month, $day);
        }

        return $date->format('Y-m-d');
    }
}
