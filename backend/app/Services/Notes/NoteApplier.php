<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Http\Resources\TaskResource;
use App\Models\Note;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\TaskPatcher;
use App\Services\Tasks\TaskRecurrence;
use DateTimeImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class NoteApplier
{
    public function __construct(private ClockInterface $clock, private TaskPatcher $patcher, private ReminderCalculator $reminders, private TaskRecurrence $recurrence) {}

    /**
     * @param  array<string, mixed>  $plan
     * @return array{applied: list<array<string, mixed>>, changes: list<array<string, mixed>>}
     */
    public function apply(Note $note, array $plan, NoteContext $context): array
    {
        $applied = [];
        $changes = [];
        $stamp = $this->clock->now()->format(DATE_ATOM);
        if (Task::query()->where('user_id', $note->user_id)->where('done', false)->count() + count($plan['create']) > Task::OPEN_LIMIT) {
            throw ValidationException::withMessages(['task' => ['task.limit']]);
        }
        foreach (['create', 'update', 'delete'] as $kind) {
            foreach ($plan[$kind] as $entry) {
                $before = null;
                if ($kind === 'create') {
                    $task = new Task;
                    $task->forceFill(array_intersect_key($entry, array_flip(Task::PATCHABLE)));
                    $task->forceFill(['user_id' => $note->user_id, 'created_by' => 'assistant', 'source_note_id' => $note->id]);
                    $task->repeat_anchor = $task->repeat === 'never' ? null : $task->due_date;
                    $task->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], $stamp);
                } else {
                    $task = Task::query()->where('user_id', $note->user_id)->where('done', false)->whereKey($entry['task_id'])->lockForUpdate()->first();
                    if ($task === null) {
                        continue;
                    }
                    $before = $task->attributesToArray();
                    if ($kind === 'delete') {
                        $task->field_updated_at = array_replace($task->field_updated_at, ['deleted' => $stamp]);
                        $task->save();
                        $task->delete();
                    } elseif (($entry['done'] ?? false) === true) {
                        $this->patcher->complete($task, $stamp);
                    } else {
                        $entry = $this->refreshSchedule($entry, $task, $context);
                        $this->patcher->patch($task, $entry, $context->timezone);
                    }
                }
                if ($kind === 'create') {
                    $task->remind_at = $task->due_date === null ? null : $this->reminders->compute((string) $task->due_date, $task->start_time, (string) $task->reminder, $context->timezone);
                    $task->save();
                }
                $task->refresh();
                $label = $entry['label'] ?? $task->title;
                $changeKind = ['create' => 'created', 'update' => 'updated', 'delete' => 'deleted'][$kind];
                $applied[] = ['kind' => $changeKind, 'task_id' => $task->id, 'before' => $before, 'label' => $label];
                $changes[] = ['kind' => $changeKind, 'task' => (new TaskResource($task))->toArray(Request::create('/')), 'label' => $label];
                if ($kind === 'update' && ($entry['done'] ?? false) === true && $task->repeat !== 'never') {
                    $next = $this->recurrence->next($task);
                    if ($next !== null) {
                        $applied[] = ['kind' => 'created', 'task_id' => $next->id, 'before' => null, 'label' => $next->title];
                        $changes[] = ['kind' => 'created', 'task' => (new TaskResource($next))->toArray(Request::create('/')), 'label' => $next->title];
                    }
                }
            }
        }

        return ['applied' => $applied, 'changes' => $changes];
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    private function refreshSchedule(array $entry, Task $task, NoteContext $context): array
    {
        if (isset($entry['due_date'])) {
            $old = $task->due_date === null ? 'no date' : ($task->due_date === $context->local()->format('Y-m-d') ? 'today' : (new DateTimeImmutable((string) $task->due_date))->format('D j M'));
            $entry['label'] = 'Due '.(new DateTimeImmutable($entry['due_date']))->format('D j M').' (was '.$old.')';
        }
        if (isset($entry['start_time']) && $task->start_time !== null && $task->end_time !== null) {
            $duration = strtotime('2000-01-01 '.$task->end_time) - strtotime('2000-01-01 '.$task->start_time);
            $end = (new DateTimeImmutable('2000-01-01 '.$entry['start_time']))->modify('+'.$duration.' seconds');
            $entry['end_time'] = $end->format('Y-m-d') === '2000-01-01' ? $end->format('H:i') : null;
        }

        return $entry;
    }
}
