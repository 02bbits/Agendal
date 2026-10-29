<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Enums\Repeat;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use DateTimeImmutable;

final class TaskRecurrence
{
    public function __construct(private ClockInterface $clock, private ReminderCalculator $reminders) {}

    public function next(Task $task): ?Task
    {
        $repeat = Repeat::tryFrom((string) $task->repeat) ?? Repeat::Never;
        if ($repeat === Repeat::Never || $task->due_date === null) {
            return null;
        }
        $existing = Task::withTrashed()->where('user_id', $task->user_id)->where('previous_occurrence_id', $task->id)->first();
        if ($existing !== null) {
            return $existing;
        }
        $zone = (string) User::query()->findOrFail($task->user_id)->timezone;
        $today = $this->clock->today($zone);
        $due = new DateTimeImmutable((string) $task->due_date);
        $anchor = new DateTimeImmutable((string) ($task->repeat_anchor ?: $task->due_date));
        $next = $due;
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
        } while ($next->format('Y-m-d') < $today);
        $copy = $task->replicate(['done_at', 'remind_at', 'deleted_at', 'change_seq']);
        $copy->done = false;
        $copy->previous_occurrence_id = $task->id;
        $copy->due_date = $next->format('Y-m-d');
        $copy->repeat_anchor = $anchor->format('Y-m-d');
        $copy->remind_at = $this->reminders->compute((string) $copy->due_date, $copy->start_time === null ? null : substr((string) $copy->start_time, 0, 5), (string) $copy->reminder, $zone);
        $stamp = $this->clock->now()->format(DATE_ATOM);
        $copy->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], $stamp);
        $copy->save();

        return $copy;
    }
}
