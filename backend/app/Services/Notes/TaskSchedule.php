<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

/** Reschedule rules shared by planning (CommandMatcher) and applying (NoteApplier) a note (NU §2.4). */
final class TaskSchedule
{
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
        $day = new DateTimeImmutable('today');
        $duration = $day->modify($oldEnd)->getTimestamp() - $day->modify($oldStart)->getTimestamp();
        if ($duration <= 0) {
            return null;
        }
        $end = $day->modify($newStart)->modify('+'.$duration.' seconds');

        return $end->format('Y-m-d') === $day->format('Y-m-d') ? $end->format('H:i') : null;
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
