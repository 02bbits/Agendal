<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\ChangeKind;
use App\Enums\CommandAction;
use App\Enums\Repeat;
use App\Enums\SkipReason;
use App\Enums\TaskCreator;
use App\Enums\WeekStart;
use App\Http\Resources\TaskResource;
use App\Models\Note;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\TaskPatcher;
use App\Services\Tasks\TaskRecurrence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Applies a validated plan inside the note's transaction: locks the matched tasks, re-validates against
 * their current values (NU-E38), writes the tasks and logs each change with its before values (ADR-002).
 *
 * @phpstan-import-type ValidatedPlan from PlanValidator
 * @phpstan-import-type TaskRow from CommandMatcher
 *
 * @phpstan-type AppliedChange array{kind: string, task_id: string, before: array<string, mixed>|null, after: array<string, mixed>, label: string}
 */
final class NoteApplier
{
    private const KIND_BY_ENTRY = ['create' => ChangeKind::Created, 'update' => ChangeKind::Updated, 'delete' => ChangeKind::Deleted];

    /** Update fields that schedule a task: an update with one of them is a move, planned again at apply (NU-E38). */
    private const MOVE_FIELDS = ['due_date', 'start_time', 'end_time'];

    public function __construct(
        private ClockInterface $clock,
        private TaskPatcher $patcher,
        private ReminderCalculator $reminders,
        private TaskRecurrence $recurrence,
        private PlanValidator $validator,
        private NoteSplitter $splitter,
        private CommandMatcher $matcher,
    ) {}

    /**
     * @param  ValidatedPlan  $plan
     * @param  array<string, array<string, mixed>>  $edits  Fields the user changed on Check this first, by entry ref
     * @return array{applied: list<AppliedChange>, changes: list<array<string, mixed>>, skipped: list<array<string, mixed>>}
     */
    public function apply(Note $note, array $plan, array $edits = []): array
    {
        $user = User::query()->findOrFail($note->user_id);
        $timezone = (string) $user->timezone;
        $projects = Project::query()->where('user_id', $note->user_id)->whereNull('deleted_at')->pluck('name', 'id')->all();
        $context = new NoteContext($note->written_at->toDateTimeImmutable(), (string) $note->written_tz, $projects,
            WeekStart::tryFrom((string) $user->week_start) ?? WeekStart::Monday, $user->time_format === '12h');
        $locked = $this->lockTargets($note, $plan);
        [$plan, $gone] = $this->revalidate($note, $plan, $locked, $context, $edits);
        if ($plan['dropped'] > 0) {
            Log::info('note_plan_validation', ['dropped' => $plan['dropped'], 'at' => 'apply']);
        }
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
                $label = $entry['label'] ?? $this->meta($task, $context);
                $applied[] = ['kind' => $changeKind->value, 'task_id' => $task->id, 'before' => $before, 'after' => $task->attributesToArray(), 'label' => $label];
                $changes[] = $this->change($changeKind, $task, $label, $entry['ref']);
                $next = ($entry['done'] ?? false) === true ? $this->recurrence->next($task, restoreDeleted: true) : null;
                if ($next !== null) {
                    // TK-4: completing a repeating task creates its next occurrence; undo removes it too.
                    $applied[] = ['kind' => ChangeKind::Created->value, 'task_id' => $next->id, 'before' => null, 'after' => $next->attributesToArray(), 'label' => $this->meta($next, $context)];
                    $changes[] = $this->change(ChangeKind::Created, $next, $this->meta($next, $context));
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
     * NU-E38: a task deleted or done since planning → its entry becomes skip not_found; a move is planned again
     * on the task as it is now.
     *
     * @param  ValidatedPlan  $plan
     * @param  array<string, Task>  $locked
     * @param  array<string, array<string, mixed>>  $edits
     * @return array{0: ValidatedPlan, 1: list<array<string, mixed>>}
     */
    private function revalidate(Note $note, array $plan, array $locked, NoteContext $context, array $edits): array
    {
        $projects = $context->projects;
        $items = $this->splitter->split($note->text, array_values($projects));
        $gone = [];
        foreach (['update', 'delete'] as $kind) {
            foreach ($plan[$kind] as $index => $entry) {
                $current = $locked[$entry['task_id']] ?? null;
                $item = $items[NoteEngine::itemIndex($entry['ref']) ?? -1] ?? null;
                if ($current === null) {
                    $gone[] = ['ref' => $entry['ref'], 'text' => $item ?? $entry['label'], 'reason' => SkipReason::NotFound->value];
                } elseif ($kind === 'update' && array_intersect_key($entry, array_flip(self::MOVE_FIELDS)) !== [] && array_intersect_key($edits[$entry['ref']] ?? [], array_flip(self::MOVE_FIELDS)) === []) {
                    $moved = $item === null ? $entry : $this->movedNow($item, $entry, $current, $context);
                    if ($moved === null) {
                        $gone[] = ['ref' => $entry['ref'], 'text' => $item, 'reason' => SkipReason::NoChange->value];
                        unset($plan[$kind][$index]);
                    } else {
                        $plan[$kind][$index] = $moved;
                    }
                }
            }
            $plan[$kind] = array_values($plan[$kind]);
        }
        foreach ($plan['create'] as $index => $entry) {
            if (isset($entry['duplicate_of']) && ! isset($locked[$entry['duplicate_of']])) {
                $plan['create'][$index]['duplicate_of'] = null;
            }
        }
        // The user's edits go in before the last validation, so an edited value is checked like a planned one.
        foreach (['create', 'update'] as $kind) {
            foreach ($plan[$kind] as $index => $entry) {
                $plan[$kind][$index] = [...$entry, ...$edits[$entry['ref']] ?? []];
            }
        }
        $rows = array_map(fn (Task $task): array => $this->row($task), $locked);

        return [$this->validator->validate($plan, $projects, $rows), $gone];
    }

    /**
     * The move planned again on the task as it is now, so "push back 1 hour" counts from its current time. Null when
     * the task already is where the move puts it. A task the command no longer finds (renamed since) keeps the
     * planned move, as the user saw it on Check this first.
     *
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>|null
     */
    private function movedNow(string $item, array $entry, Task $task, NoteContext $context): ?array
    {
        /** @var TaskRow $row */
        $row = $this->row($task);
        foreach ($this->matcher->matchEach($item, CommandAction::Reschedule, [$row], [], $context) as $match) {
            if ($match->change?->taskId === $task->id) {
                return ['ref' => $entry['ref'], 'task_id' => $task->id, 'label' => $match->change->label, ...$match->change->fields];
            }
            if ($match->skip === SkipReason::NoChange) {
                return null;
            }
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
        if (array_key_exists('end_time', $entry)) {
            $entry['due_time'] = $entry['end_time'];
        }
        $stamp = $this->clock->now()->format(DATE_ATOM);
        $task = new Task;
        $task->forceFill(array_intersect_key($entry, array_flip(Task::PATCHABLE)));
        if ($task->start_time !== null && $task->start_date === null) {
            $task->start_date = $task->due_date;
        }
        $task->forceFill(['user_id' => $note->user_id, 'created_by' => TaskCreator::Assistant->value, 'source_note_id' => $note->id]);
        $task->repeat_anchor = $task->repeat === Repeat::Never->value ? null : ($task->start_date ?: $task->due_date);
        $task->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], $stamp);
        $task->remind_at = ($task->start_date === null && $task->due_date === null) || $task->reminder === 'none'
            ? null
            : $this->reminders->forDates(
                $task->start_date ? substr((string) $task->start_date, 0, 10) : null,
                $task->start_time !== null ? substr((string) $task->start_time, 0, 5) : null,
                $task->due_date ? substr((string) $task->due_date, 0, 10) : null,
                $task->due_time !== null ? substr((string) $task->due_time, 0, 5) : null,
                (string) $task->reminder,
                $timezone,
            );
        $task->save();

        return $task->refresh();
    }

    /** @param array<string, mixed> $entry */
    private function update(Task $task, array $entry, string $timezone): Task
    {
        if (array_key_exists('end_time', $entry)) {
            $entry['due_time'] = $entry['end_time'];
        }
        $oldDueDate = $task->due_date ? substr((string) $task->due_date, 0, 10) : null;
        $oldStartDate = $task->start_date ? substr((string) $task->start_date, 0, 10) : null;
        if (array_key_exists('due_date', $entry) && $entry['due_date'] !== $oldDueDate) {
            if ($oldStartDate !== null && $oldStartDate === $oldDueDate) {
                $entry['start_date'] = $entry['due_date'];
            }
        }
        $at = $this->patcher->afterLastWrite($task);
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
        $task->field_updated_at = array_replace($task->field_updated_at ?? [], ['deleted' => $this->patcher->afterLastWrite($task)]);
        $task->save();
        $task->delete();

        return $task;
    }

    /** @return array<string, mixed> the task as the plan validator compares it */
    private function row(Task $task): array
    {
        $row = $task->attributesToArray();
        $row['start_time'] = isset($row['start_time']) ? substr((string) $row['start_time'], 0, 5) : null;
        $row['end_time'] = isset($row['due_time']) ? substr((string) $row['due_time'], 0, 5) : null;
        $row['due_date'] = isset($row['due_date']) ? substr((string) $row['due_date'], 0, 10) : null;

        return $row;
    }

    /** A created row's meta (RV §2.1): "Mon 26 Oct · 09:00 · SQL Course", empty parts left out. */
    private function meta(Task $task, NoteContext $context): string
    {
        $row = $this->row($task);

        return implode(' · ', array_filter([$context->scheduled($row['due_date'], $row['start_time'], ' · '), $context->projects[(string) $row['project_id']] ?? null]));
    }

    /** @return array<string, mixed> one change in the note result */
    private function change(ChangeKind $kind, Task $task, string $label, ?string $ref = null): array
    {
        $change = ['kind' => $kind->value, 'task' => (new TaskResource($task))->toArray(Request::create('/')), 'label' => $label];

        return $ref === null ? $change : [...$change, 'ref' => $ref];
    }
}
