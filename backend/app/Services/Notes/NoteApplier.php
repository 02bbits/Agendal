<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\ChangeKind;
use App\Enums\Repeat;
use App\Enums\SkipReason;
use App\Enums\TaskCreator;
use App\Http\Resources\TaskResource;
use App\Models\Note;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\TaskPatcher;
use App\Services\Tasks\TaskRecurrence;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Applies a validated plan inside the note's transaction: locks the matched tasks, re-validates against
 * their current values (NU-E38), writes the tasks and logs each change with its before values (ADR-002).
 *
 * @phpstan-import-type ValidatedPlan from PlanValidator
 *
 * @phpstan-type AppliedChange array{kind: string, task_id: string, before: array<string, mixed>|null, label: string}
 */
final class NoteApplier
{
    private const KIND_BY_ENTRY = ['create' => ChangeKind::Created, 'update' => ChangeKind::Updated, 'delete' => ChangeKind::Deleted];

    public function __construct(
        private ClockInterface $clock,
        private TaskPatcher $patcher,
        private ReminderCalculator $reminders,
        private TaskRecurrence $recurrence,
        private PlanValidator $validator,
        private TaskSchedule $schedule,
    ) {}

    /**
     * @param  ValidatedPlan  $plan
     * @return array{applied: list<AppliedChange>, changes: list<array<string, mixed>>, skipped: list<array<string, mixed>>}
     */
    public function apply(Note $note, array $plan, NoteContext $context): array
    {
        $timezone = (string) User::query()->findOrFail($note->user_id)->timezone;
        $locked = $this->lockTargets($note, $plan);
        [$plan, $gone] = $this->revalidate($note, $plan, $locked, $context);
        $this->guardOpenLimit($note, count($plan['create']));
        $applied = [];
        $changes = [];
        foreach (self::KIND_BY_ENTRY as $entryKind => $changeKind) {
            foreach ($plan[$entryKind] as $entry) {
                $before = $entryKind === 'create' ? null : $locked[$entry['task_id']]->attributesToArray();
                $task = match ($entryKind) {
                    'create' => $this->create($note, $entry, $timezone),
                    'update' => $this->update($locked[$entry['task_id']], $entry, $timezone),
                    'delete' => $this->delete($locked[$entry['task_id']]),
                };
                $label = $entry['label'] ?? $task->title;
                $applied[] = ['kind' => $changeKind->value, 'task_id' => $task->id, 'before' => $before, 'label' => $label];
                $changes[] = $this->change($changeKind, $task, $label);
                $next = ($entry['done'] ?? false) === true ? $this->recurrence->next($task) : null;
                if ($next !== null) {
                    // TK-4: completing a repeating task creates its next occurrence; undo removes it too.
                    $applied[] = ['kind' => ChangeKind::Created->value, 'task_id' => $next->id, 'before' => null, 'label' => $next->title];
                    $changes[] = $this->change(ChangeKind::Created, $next, $next->title);
                }
            }
        }

        return ['applied' => $applied, 'changes' => $changes, 'skipped' => [...$plan['skipped'], ...$gone]];
    }

    /**
     * Row locks on the open tasks the plan names, so two devices can't both change one (NU §8).
     *
     * @param  ValidatedPlan  $plan
     * @return array<string, Task>
     */
    private function lockTargets(Note $note, array $plan): array
    {
        $ids = array_values(array_filter([
            ...array_column($plan['update'], 'task_id'),
            ...array_column($plan['delete'], 'task_id'),
            ...array_column($plan['create'], 'duplicate_of'),
        ]));

        return Task::query()->where('user_id', $note->user_id)->where('done', false)->whereIn('id', $ids)
            ->lockForUpdate()->get()->keyBy('id')->all();
    }

    /**
     * NU-E38: a task deleted or done since planning → its entry becomes skip not_found; a changed task gets
     * the change on its current values and a current "was" label.
     *
     * @param  ValidatedPlan  $plan
     * @param  array<string, Task>  $locked
     * @return array{0: ValidatedPlan, 1: list<array<string, mixed>>}
     */
    private function revalidate(Note $note, array $plan, array $locked, NoteContext $context): array
    {
        $gone = [];
        foreach (['update', 'delete'] as $kind) {
            foreach ($plan[$kind] as $index => $entry) {
                $current = $locked[$entry['task_id']] ?? null;
                if ($current === null) {
                    $gone[] = ['ref' => $entry['ref'], 'text' => $entry['label'], 'reason' => SkipReason::NotFound->value];
                } elseif ($kind === 'update' && ! isset($entry['done'])) {
                    $plan[$kind][$index] = $this->onCurrentSchedule($entry, $current, $context);
                }
            }
        }
        foreach ($plan['create'] as $index => $entry) {
            if (isset($entry['duplicate_of']) && ! isset($locked[$entry['duplicate_of']])) {
                $plan['create'][$index]['duplicate_of'] = null;
            }
        }
        $rows = array_map(fn (Task $task): array => $this->row($task), $locked);
        $projects = Project::query()->where('user_id', $note->user_id)->whereNull('deleted_at')->pluck('name', 'id')->all();

        return [$this->validator->validate($plan, $projects, $rows), $gone];
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    private function onCurrentSchedule(array $entry, Task $task, NoteContext $context): array
    {
        $row = $this->row($task);
        if (isset($entry['due_date'])) {
            $entry['label'] = $this->schedule->dueLabel($entry['due_date'], $row['due_date'], $context);
        }
        if (isset($entry['start_time']) && $row['start_time'] !== null && $row['end_time'] !== null) {
            $entry['end_time'] = $this->schedule->movedEnd($row['start_time'], $row['end_time'], $entry['start_time']);
        }

        return $entry;
    }

    private function guardOpenLimit(Note $note, int $creates): void
    {
        $open = Task::query()->where('user_id', $note->user_id)->where('done', false)->count();
        if ($open + $creates > Task::OPEN_LIMIT) {
            throw ValidationException::withMessages(['task' => ['task.limit']]);
        }
    }

    /** @param array<string, mixed> $entry */
    private function create(Note $note, array $entry, string $timezone): Task
    {
        $stamp = $this->clock->now()->format(DATE_ATOM);
        $task = new Task;
        $task->forceFill(array_intersect_key($entry, array_flip(Task::PATCHABLE)));
        $task->forceFill(['user_id' => $note->user_id, 'created_by' => TaskCreator::Assistant->value, 'source_note_id' => $note->id]);
        $task->repeat_anchor = $task->repeat === Repeat::Never->value ? null : $task->due_date;
        $task->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], $stamp);
        $task->remind_at = $task->due_date === null ? null : $this->reminders->compute((string) $task->due_date, $task->start_time, (string) $task->reminder, $timezone);
        $task->save();

        return $task->refresh();
    }

    /** @param array<string, mixed> $entry */
    private function update(Task $task, array $entry, string $timezone): Task
    {
        $at = $this->afterLastWrite($task);
        $fields = array_intersect_key($entry, array_flip(Task::PATCHABLE));
        if (($entry['done'] ?? false) === true) {
            $this->patcher->complete($task, $at);
        }
        if ($fields !== []) {
            $this->patcher->patch($task, [...$fields, 'at' => $at], $timezone);
        }

        return $task->refresh();
    }

    private function delete(Task $task): Task
    {
        $task->field_updated_at = array_replace($task->field_updated_at ?? [], ['deleted' => $this->afterLastWrite($task)]);
        $task->save();
        $task->delete();

        return $task;
    }

    /**
     * Last write wins per field (TK). A note is a server action on the locked current row, so it must win
     * even when the task was written in the same second: one second after the newest field stamp, or now.
     */
    private function afterLastWrite(Task $task): string
    {
        $at = $this->clock->now()->setTimezone(new DateTimeZone('UTC'));
        foreach ($task->field_updated_at ?? [] as $stamp) {
            $next = (new DateTimeImmutable((string) $stamp))->setTimezone(new DateTimeZone('UTC'))->modify('+1 second');
            $at = max($at, $next);
        }

        return $at->format('Y-m-d\TH:i:s\Z');
    }

    /** @return array<string, mixed> the task as the plan validator compares it */
    private function row(Task $task): array
    {
        $row = $task->attributesToArray();
        foreach (['start_time', 'end_time'] as $key) {
            $row[$key] = isset($row[$key]) ? substr((string) $row[$key], 0, 5) : null;
        }
        $row['due_date'] = isset($row['due_date']) ? substr((string) $row['due_date'], 0, 10) : null;

        return $row;
    }

    /** @return array<string, mixed> one change in the note result */
    private function change(ChangeKind $kind, Task $task, string $label): array
    {
        return ['kind' => $kind->value, 'task' => (new TaskResource($task))->toArray(Request::create('/')), 'label' => $label];
    }
}
