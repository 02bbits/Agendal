<?php

declare(strict_types=1);

namespace App\Services\Push;

use App\Models\Task;
use DateTimeImmutable;

/**
 * What a reminder says (TK §2.5): the task title, then `Mon 09:00 · SQL Course`. The day and time
 * are the ones the reminder counts from (BR-12: the start, else the due), floating local values
 * (ADR-006) shown in the user's time format. Nothing else leaves the server: no notes, no ids
 * beyond the task's own link.
 */
final class ReminderMessage
{
    /**
     * @return array{title: string, body: string, url: string, tag: string}
     */
    public static function for(Task $task, ?string $projectName, string $timeFormat): array
    {
        $start = self::date($task->getAttribute('start_date'));
        [$date, $time] = $start !== null
            ? [$start, self::time($task->getAttribute('start_time'))]
            : [self::date($task->getAttribute('due_date')), self::time($task->getAttribute('due_time'))];

        $when = $date !== null ? (new DateTimeImmutable($date))->format('D') : null;
        if ($when !== null && $time !== null) {
            $when .= ' '.self::clock($time, $timeFormat);
        }

        return [
            'title' => (string) $task->title,
            'body' => implode(' · ', array_filter([$when, $projectName], fn ($part) => $part !== null && $part !== '')),
            'url' => '/tasks/'.$task->id,
            // One notification per task on the device: a repeat replaces it, never stacks
            'tag' => 'task-'.$task->id,
        ];
    }

    private static function date(mixed $value): ?string
    {
        return $value ? substr((string) $value, 0, 10) : null;
    }

    private static function time(mixed $value): ?string
    {
        return $value !== null && $value !== '' ? substr((string) $value, 0, 5) : null;
    }

    /** `09:00`, or `9:00 am` with the 12-hour setting (AP-5). */
    private static function clock(string $time, string $format): string
    {
        if ($format !== '12h') {
            return $time;
        }
        [$h, $m] = array_map('intval', explode(':', $time));

        return sprintf('%d:%02d %s', $h % 12 === 0 ? 12 : $h % 12, $m, $h < 12 ? 'am' : 'pm');
    }
}
