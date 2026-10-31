<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

/** Reschedule rules shared by planning (CommandMatcher) and applying (NoteApplier) a note (NU §2.4). */
final class TaskSchedule
{
    private const MINUTES_PER_DAY = 1440;

    /** "Due Sun 25 Oct (was today)", "(was no date)". */
    public function dueLabel(string $newDate, ?string $oldDate, NoteContext $context): string
    {
        return __('notes.label.due', ['date' => $this->labelDate($newDate), 'was' => $this->was($oldDate, $context)]);
    }

    /**
     * NU-E35: a new start moves the end by the task's duration. An end that would pass midnight, or a
     * task whose end is not after its start, has no end (TK-3).
     */
    public function movedEnd(string $oldStart, string $oldEnd, string $newStart): ?string
    {
        $duration = $this->minutes($oldEnd) - $this->minutes($oldStart);
        $end = $this->minutes($newStart) + $duration;
        if ($duration <= 0 || $end >= self::MINUTES_PER_DAY) {
            return null;
        }

        return sprintf('%02d:%02d', intdiv($end, 60), $end % 60);
    }

    /** "09:30" → 570. */
    private function minutes(string $time): int
    {
        [$hour, $minute] = array_map(intval(...), explode(':', $time));

        return $hour * 60 + $minute;
    }

    private function was(?string $date, NoteContext $context): string
    {
        return match ($date) {
            null => __('notes.label.was_no_date'),
            $context->today()->format('Y-m-d') => __('notes.label.was_today'),
            $context->today()->modify('+1 day')->format('Y-m-d') => __('notes.label.was_tomorrow'),
            default => $this->labelDate($date),
        };
    }

    private function labelDate(string $date): string
    {
        return (new DateTimeImmutable($date))->format(__('notes.label.date_format'));
    }
}
