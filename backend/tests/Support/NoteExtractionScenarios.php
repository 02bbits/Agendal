<?php

declare(strict_types=1);

namespace Tests\Support;

use DateTimeImmutable;
use RuntimeException;

/**
 * Extraction scenarios generated from every field-extractor rule in the shared note rules CSV.
 * The clock is the corpus's: Friday 23 Oct 2026, 08:12 in Ho Chi Minh City.
 */
final class NoteExtractionScenarios
{
    public const NOW = '2026-10-23T08:12:00+07:00';

    private const EVENING = '2026-10-23T22:00:00+07:00';

    /** Categories only the field extractor reads; the splitter generator skips them. */
    public const EXTRACTION_ONLY_CATEGORIES = [
        'day_count_prefix', 'day_count_unit', 'day_count_suffix', 'date_separator', 'date_day_word', 'month_word',
        'date_preferred_prefix', 'weekday_this', 'weekday_this_suffix', 'weekday_next', 'repeat_prefix', 'day_bound',
        'not_time_word', 'period_am', 'period_pm', 'hour_suffix', 'minute_separator', 'hour_prefix', 'range_prefix',
        'range_separator', 'reminder_day_before', 'acronym', 'name_title', 'vietnamese_ascii_word', 'count_word',
    ];

    /** @return array<string, array{0: string, 1: array<string, mixed>, 2: string}> note, expected fields, now */
    public static function generate(string $rulesPath): array
    {
        $file = fopen($rulesPath, 'rb');
        if ($file === false) {
            throw new RuntimeException('Missing note rules CSV');
        }
        try {
            fgetcsv($file, null, ',', '"', '');
            $cases = [];
            while (($row = fgetcsv($file, null, ',', '"', '')) !== false) {
                if ($row === [null] || count($row) !== 2) {
                    continue;
                }
                [$category, $value] = array_map(trim(...), array_map('strval', $row));
                $examples = self::examples($category, $value);
                if ($examples === [] && in_array($category, self::EXTRACTION_ONLY_CATEGORIES, true)) {
                    throw new RuntimeException('Add extraction templates for rule category '.$category);
                }
                foreach ($examples as $index => [$note, $expected, $now]) {
                    $cases[$category.' / '.$value.' / '.$index] = [$note, $expected, $now];
                }
            }

            return $cases;
        } finally {
            fclose($file);
        }
    }

    /** @return list<array{0: string, 1: array<string, mixed>, 2: string}> */
    private static function examples(string $category, string $value): array
    {
        [$family, $key] = array_pad(explode(':', $category, 2), 2, '');

        return match ($family) {
            'date_offset' => [['đọc sách '.$value, ['dueDate' => self::day((int) $key)], self::NOW]],
            'weekday' => [['đọc sách '.$value, ['dueDate' => self::day(self::daysUntilWeekday((int) $key) ?: 7)], self::NOW]],
            'month' => [['đọc sách 15 '.$value, ['dueDate' => self::yearlessDate(15, (int) $key)], self::NOW]],
            'repeat' => [['tập gym '.$value, ['repeat' => $key], self::NOW]],
            'time_word' => [['đọc sách '.$value, ['startTime' => $key], self::NOW]],
            'week_next' => [['đọc sách '.$value, ['dueDate' => '2026-10-26'], self::NOW]],
            'week_end' => [['đọc sách '.$value, ['dueDate' => '2026-10-25'], self::NOW]],
            'weekend' => [['đọc sách '.$value, ['dueDate' => '2026-10-24'], self::NOW]],
            'count_word' => [['uống thuốc ngày 2 '.$value, ['dueDate' => null], self::NOW]],
            'month_end' => [['đọc sách '.$value, ['dueDate' => '2026-10-31'], self::NOW]],
            'repeat_unsupported' => [['tập gym '.$value, ['repeat' => 'never', 'lowConfidence' => true], self::NOW]],
            'priority_high' => [['đọc sách '.$value, ['priority' => 'high', 'title' => 'Đọc sách'], self::NOW]],
            'priority_high_content' => [['đọc sách '.$value, ['priority' => 'high'], self::NOW]],
            'priority_low' => [['đọc sách '.$value, ['priority' => 'low', 'title' => 'Đọc sách'], self::NOW]],
            'reminder_day_before' => [['đọc sách '.$value.' ngày mai', ['reminder' => '1d'], self::NOW]],
            'acronym' => [['đọc '.mb_strtolower($value), ['title' => 'Đọc '.$value], self::NOW]],
            'name_title' => [['gặp '.$value.' mai', ['dueDate' => null, 'lowConfidence' => true], self::NOW]],
            'vietnamese_ascii_word' => [['hop nhom '.$value, ['dueDate' => null], self::NOW]],
            'not_time_word' => [['đọc '.$value, ['startTime' => null], self::NOW]],
            'day_bound' => [['đọc sách '.$value, ['startTime' => null, 'dueDate' => '2026-10-23'], self::EVENING]],
            'period_am' => [['họp 9 '.$value, ['startTime' => '09:00'], self::NOW]],
            'period_pm' => [['họp 2 '.$value, ['startTime' => '14:00'], self::NOW]],
            'hour_suffix' => [['họp 9'.$value, ['startTime' => '09:00'], self::NOW]],
            'minute_separator' => [['họp 9'.$value.'30', ['startTime' => '09:30'], self::NOW]],
            'hour_prefix' => [['họp '.$value.' 9', ['startTime' => '09:00'], self::NOW]],
            'range_prefix' => [['họp '.$value.' 9 to 11', ['startTime' => '09:00', 'endTime' => '11:00'], self::NOW]],
            'range_separator' => [['họp 9am '.$value.' 11am', ['startTime' => '09:00', 'endTime' => '11:00'], self::NOW]],
            'date_preferred_prefix' => [['học thứ 2 '.$value.' thứ 7', ['dueDate' => '2026-10-24'], self::NOW]],
            'weekday_this' => [['nộp '.$value.' friday', ['dueDate' => '2026-10-23'], self::NOW]],
            'weekday_this_suffix' => [['nộp thứ 6 '.$value, ['dueDate' => '2026-10-23'], self::NOW]],
            'weekday_next' => [['nộp '.$value.' monday', ['dueDate' => '2026-10-26'], self::NOW]],
            'repeat_prefix' => [['tập gym '.$value.' monday', ['repeat' => 'weekly', 'dueDate' => '2026-10-26'], self::NOW]],
            'day_count_prefix' => [['đọc sách '.$value.' 3 days', ['dueDate' => self::day(3)], self::NOW]],
            'day_count_unit' => [['đọc sách in 3 '.$value, ['dueDate' => self::day(3)], self::NOW]],
            'day_count_suffix' => [['đọc sách 3 ngày '.$value, ['dueDate' => self::day(3)], self::NOW]],
            'date_separator' => [['đọc sách 26'.$value.'10', ['dueDate' => '2026-10-26'], self::NOW]],
            'date_day_word' => [['đọc sách '.$value.' 26/10', ['dueDate' => '2026-10-26', 'title' => 'Đọc sách'], self::NOW]],
            'month_word' => [['đọc sách 26 '.$value.' 10', ['dueDate' => '2026-10-26'], self::NOW]],
            default => [],
        };
    }

    private static function today(): DateTimeImmutable
    {
        return (new DateTimeImmutable(self::NOW))->setTime(0, 0);
    }

    private static function day(int $days): string
    {
        return self::today()->modify('+'.$days.' days')->format('Y-m-d');
    }

    private static function daysUntilWeekday(int $weekday): int
    {
        return ($weekday - (int) self::today()->format('w') + 7) % 7;
    }

    /** NU-E4 with the default 30-day grace. */
    private static function yearlessDate(int $day, int $month): string
    {
        $date = self::today()->setDate((int) self::today()->format('Y'), $month, $day);

        return ($date < self::today()->modify('-30 days') ? $date->modify('+1 year') : $date)->format('Y-m-d');
    }
}
