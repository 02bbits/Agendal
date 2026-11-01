<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;

/** Reschedule rules shared by planning (CommandMatcher) and applying (NoteApplier) a note (NU §2.4). */
final class TaskSchedule
{
    /** "Due Fri 30 Oct 09:00", "Due Fri 30 Oct", "Due 09:00". */
    public function dueLabel(?string $date, ?string $start): string
    {
        return __('notes.label.due', ['when' => $this->scheduled($date, $start)]);
    }

    /** "Fri 30 Oct 09:00", "Fri 30 Oct", "09:00"; empty for neither. */
    public function scheduled(?string $date, ?string $start): string
    {
        $day = $date === null ? '' : (new DateTimeImmutable($date))->format(__('notes.label.date_format'));

        return trim($day.' '.$start);
    }

    /** NU-E35: a new start moves the end by the task's duration. No end when it would pass midnight or isn't after the start (TK-3). */
    public function movedEnd(string $oldStart, string $oldEnd, string $newStart): ?string
    {
        $duration = NoteDurations::clockMinutes($oldEnd) - NoteDurations::clockMinutes($oldStart);

        return $duration <= 0 ? null : NoteDurations::clockTime(NoteDurations::clockMinutes($newStart) + $duration);
    }
}
