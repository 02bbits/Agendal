<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Enums\Repeat;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Support\Stamp;
use DateTimeImmutable;

final class TaskRecurrence
{
    public function __construct(private ClockInterface $clock, private ReminderCalculator $reminders) {}

    public function next(Task $task, bool $restoreDeleted = false): ?Task
    {
        $repeat = Repeat::tryFrom((string) $task->repeat) ?? Repeat::Never;
        if ($repeat === Repeat::Never || ($task->start_date === null && $task->due_date === null)) {
            return null;
        }
        $existing = Task::withTrashed()->where('user_id', $task->user_id)->where('previous_occurrence_id', $task->id)->first();
        if ($existing !== null && (! $restoreDeleted || ! $existing->trashed() || $existing->done)) {
            return $existing;
        }
        $zone = (string) User::query()->findOrFail($task->user_id)->timezone;
        $today = $this->clock->today($zone);

        $leadDateStr = $task->start_date !== null ? (string) $task->start_date : (string) $task->due_date;
        $lead = new DateTimeImmutable(substr($leadDateStr, 0, 10));

        $gap = 0;
        if ($task->start_date !== null && $task->due_date !== null) {
            $sd = new DateTimeImmutable(substr((string) $task->start_date, 0, 10));
            $dd = new DateTimeImmutable(substr((string) $task->due_date, 0, 10));
            $gap = (int) $sd->diff($dd)->days;
        }

        $anchorDateStr = (string) ($task->repeat_anchor ?: ($task->start_date ?: $task->due_date));
        $anchor = new DateTimeImmutable(substr($anchorDateStr, 0, 10));

        $next = $lead;
        if ($task->repeat_rule !== null) {
            $todayMinusGap = (new DateTimeImmutable($today))->modify("-{$gap} days")->format('Y-m-d');
            $from = max($todayMinusGap, $lead->modify('+1 day')->format('Y-m-d'));
            $date = RepeatSchedule::onOrAfter((string) $task->repeat_rule, $anchor->format('Y-m-d'), $from);
            if ($date === null) {
                return null;
            }
            $next = new DateTimeImmutable($date);
        } else {
            do {
                $next = match ($repeat) {
                    Repeat::Daily => $next->modify('+1 day'),
                    Repeat::Weekly => $next->modify('+7 days'),
                    Repeat::Monthly => $next->modify('first day of next month'),
                    Repeat::Yearly => $next->setDate((int) $next->format('Y') + 1, (int) $anchor->format('m'), 1),
                };
                // Monthly and yearly keep the anchor's day, or the month's last day when it is shorter.
                if (in_array($repeat, [Repeat::Monthly, Repeat::Yearly], true)) {
                    $next = $next->setDate((int) $next->format('Y'), (int) $next->format('m'), min((int) $anchor->format('d'), (int) $next->format('t')));
                }
            } while ($next->modify("+{$gap} days")->format('Y-m-d') < $today);
        }
        $copy = $existing ?? $task->replicate(['done_at', 'remind_at', 'deleted_at', 'change_seq']);
        if ($existing !== null) {
            $copy->forceFill($task->only([...Task::PATCHABLE, 'user_id', 'created_by', 'source_note_id']));
        }
        $copy->done = false;
        $copy->done_at = null;
        $copy->previous_occurrence_id = $task->id;

        if ($task->start_date !== null) {
            $copy->start_date = $next->format('Y-m-d');
        } else {
            $copy->start_date = null;
        }

        if ($task->due_date !== null) {
            $copy->due_date = $task->start_date !== null
                ? $next->modify("+{$gap} days")->format('Y-m-d')
                : $next->format('Y-m-d');
        } else {
            $copy->due_date = null;
        }

        $copy->repeat_anchor = $anchor->format('Y-m-d');
        $copy->remind_at = $this->reminders->forDates(
            $copy->start_date ? substr((string) $copy->start_date, 0, 10) : null,
            $copy->start_time !== null ? substr((string) $copy->start_time, 0, 5) : null,
            $copy->due_date ? substr((string) $copy->due_date, 0, 10) : null,
            $copy->due_time !== null ? substr((string) $copy->due_time, 0, 5) : null,
            (string) $copy->reminder,
            $zone,
        );
        $stamp = $this->clock->now();
        if ($existing !== null) {
            foreach ($existing->field_updated_at as $value) {
                $stamp = max($stamp, Stamp::time($value)->modify('+1 millisecond'));
            }
        }
        $copy->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], Stamp::of($stamp));
        if ($copy->trashed()) {
            $copy->restore();
        } else {
            $copy->save();
        }

        return $copy;
    }
}
