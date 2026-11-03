<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\ChangeKind;
use App\Exceptions\ApiError;
use App\Models\Note;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\TaskPatcher;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Undo all and its 10 s redo (RV §2.4, ADR-002): replays notes.applied in reverse in one transaction, then
 * keeps what it touched in notes.undo_log = {redo_until, changes: [{task_id, before, after}]} so redo is exact.
 */
final class NoteUndo
{
    public const UNDO_DAYS = 30;

    public const REDO_SECONDS = 10;

    /** Task columns a redo writes back; ids, owner, source and sync bookkeeping stay as they are. */
    private const SNAPSHOT_SKIP = ['id', 'user_id', 'created_by', 'source_note_id', 'previous_occurrence_id', 'created_at', 'updated_at', 'change_seq', 'field_updated_at'];

    public function __construct(
        private ClockInterface $clock,
        private TaskPatcher $patcher,
        private ReminderCalculator $reminders,
    ) {}

    public function undo(Note $note, bool $confirmConflicts): Note
    {
        return DB::transaction(function () use ($note, $confirmConflicts): Note {
            $note = $this->lock($note);
            if ($note->status === 'undone') {
                return $note; // RV-E5: the second request changes nothing
            }
            if ($note->status !== 'done') {
                throw new ApiError('note.wrong_status', 'This note has already been handled.', 409);
            }
            if ($note->processed_at->modify('+'.self::UNDO_DAYS.' days') < $this->clock->now()) {
                throw new ApiError('note.undo_expired', 'Notes can be undone for 30 days.', 409);
            }
            $tasks = Task::withTrashed()->where('user_id', $note->user_id)->whereIn('id', array_column($note->applied, 'task_id'))
                ->lockForUpdate()->get()->keyBy('id');
            $conflicts = $this->conflicts($note->applied, $tasks->all());
            if ($conflicts !== [] && ! $confirmConflicts) {
                throw new ApiError('note.undo_conflicts', 'Some tasks from this note were edited since.', 409, extra: ['tasks' => $conflicts]);
            }
            $zone = (string) User::query()->findOrFail($note->user_id)->timezone;
            $changes = [];
            foreach (array_reverse($note->applied) as $entry) {
                $task = $tasks[$entry['task_id']] ?? null;
                if ($task === null) {
                    continue;
                }
                $was = $task->attributesToArray();
                match ($entry['kind']) {
                    ChangeKind::Created->value => $this->remove($task),
                    ChangeKind::Updated->value => $this->revert($task, $entry, $zone),
                    ChangeKind::Deleted->value => $this->bringBack($task),
                    default => null,
                };
                $changes[] = ['task_id' => $task->id, 'before' => $was, 'after' => $task->attributesToArray()];
            }
            $redoUntil = $this->clock->now()->modify('+'.self::REDO_SECONDS.' seconds');
            $note->status = 'undone';
            $note->undo_log = ['redo_until' => $redoUntil->format(DATE_ATOM), 'changes' => $changes];
            $note->save();

            return $note->refresh();
        }, 3);
    }

    public function redo(Note $note): Note
    {
        $expired = false;
        $note = DB::transaction(function () use ($note, &$expired): Note {
            $note = $this->lock($note);
            if ($note->status === 'done') {
                return $note;
            }
            if ($note->status !== 'undone') {
                throw new ApiError('note.wrong_status', 'This note has already been handled.', 409);
            }
            $log = $note->undo_log ?? [];
            if (! isset($log['redo_until']) || new \DateTimeImmutable($log['redo_until']) < $this->clock->now()) {
                $note->undo_log = null; // the log is only kept while redo is possible
                $note->save();
                $expired = true;

                return $note;
            }
            foreach (array_reverse($log['changes']) as $change) {
                $task = Task::withTrashed()->where('user_id', $note->user_id)->whereKey($change['task_id'])->lockForUpdate()->first();
                if ($task === null) {
                    continue;
                }
                // The state before the undo, back as it was. ponytail: stamps every field, so an edit made in the 10 s window is lost.
                $stamp = $this->patcher->afterLastWrite($task);
                $task->forceFill(Arr::except($change['before'], self::SNAPSHOT_SKIP));
                if ($task->start_time !== null && $task->start_date === null) {
                    $task->start_date = $task->due_date;
                }
                $task->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], $stamp);
                $task->save();
            }
            $note->status = 'done';
            $note->undo_log = null;
            $note->save();

            return $note->refresh();
        }, 3);
        if ($expired) {
            throw new ApiError('note.redo_expired', 'This can no longer be redone.', 409);
        }

        return $note;
    }

    private function lock(Note $note): Note
    {
        return Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();
    }

    /**
     * A conflict is a created task (or the next occurrence a completion made) edited or completed since the note.
     *
     * @param  list<array<string, mixed>>  $applied
     * @param  array<string, Task>  $tasks
     * @return list<array{id: string, title: string}>
     */
    private function conflicts(array $applied, array $tasks): array
    {
        $found = [];
        foreach ($applied as $entry) {
            $task = $tasks[$entry['task_id']] ?? null;
            if ($entry['kind'] === ChangeKind::Created->value && $task !== null && ! $task->trashed() && ! $this->holds($task, $entry['after'], [...Task::PATCHABLE, 'done'])) {
                $found[] = ['id' => $task->id, 'title' => (string) $task->title];
            }
        }

        return $found;
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  list<string>  $fields
     */
    private function holds(Task $task, array $values, array $fields): bool
    {
        $current = $task->attributesToArray();
        foreach ($fields as $field) {
            if (($current[$field] ?? null) !== ($values[$field] ?? null)) {
                return false;
            }
        }

        return true;
    }

    /** A created task goes, with every occurrence its completion generated since. */
    private function remove(Task $task): void
    {
        while ($task !== null && ! $task->trashed()) {
            $this->softDelete($task);
            $task = Task::query()->where('user_id', $task->user_id)->where('previous_occurrence_id', $task->id)->lockForUpdate()->first();
        }
    }

    private function softDelete(Task $task): void
    {
        $task->field_updated_at = array_replace($task->field_updated_at ?? [], ['deleted' => $this->patcher->afterLastWrite($task)]);
        $task->save();
        $task->delete();
    }

    /**
     * Each field the note changed goes back, only where it still holds the note's value (RV §2.4, RV-E7).
     *
     * @param  array<string, mixed>  $entry
     */
    private function revert(Task $task, array $entry, string $zone): void
    {
        if ($task->trashed()) {
            return;
        }
        $before = $entry['before'];
        $after = $entry['after'];
        $stamp = $this->patcher->afterLastWrite($task);
        $stamps = $task->field_updated_at ?? [];
        $current = $task->attributesToArray();
        $restore = [];
        foreach ([...Task::PATCHABLE, 'done'] as $field) {
            if (($before[$field] ?? null) !== ($after[$field] ?? null) && ($current[$field] ?? null) === ($after[$field] ?? null)) {
                $restore[$field] = $before[$field] ?? null;
            }
        }
        if ($restore === []) {
            return;
        }
        if (array_key_exists('done', $restore)) {
            $restore['done_at'] = $before['done_at'] ?? null;
        }
        if (array_key_exists('repeat', $restore)) {
            $restore['repeat_anchor'] = $before['repeat_anchor'] ?? null;
        }
        $task->forceFill($restore);
        if ($task->start_time !== null && $task->start_date === null) {
            $task->start_date = $task->due_date;
            $stamps['start_date'] = $stamp;
        }
        foreach (array_keys($restore) as $field) {
            $stamps[$field] = $stamp;
        }
        if (array_intersect(['start_date', 'due_date', 'start_time', 'due_time', 'reminder'], array_keys($restore)) !== []) {
            $task->remind_at = ($task->start_date === null && $task->due_date === null) || $task->reminder === 'none' ? null
                : $this->reminders->forDates(
                    $task->start_date ? substr((string) $task->start_date, 0, 10) : null,
                    $task->start_time !== null ? substr((string) $task->start_time, 0, 5) : null,
                    $task->due_date ? substr((string) $task->due_date, 0, 10) : null,
                    $task->due_time !== null ? substr((string) $task->due_time, 0, 5) : null,
                    (string) $task->reminder,
                    $zone,
                );
        }
        $task->field_updated_at = $stamps;
        $task->save();
    }

    private function bringBack(Task $task): void
    {
        if (! $task->trashed()) {
            return; // restored by hand already
        }
        $task->field_updated_at = array_replace($task->field_updated_at ?? [], ['deleted' => $this->patcher->afterLastWrite($task)]);
        if ($task->project_id !== null && ! Project::query()->whereNull('deleted_at')->whereKey($task->project_id)->exists()) {
            $task->project_id = null; // RV §2.4: its project is gone, so No project
        }
        $task->save();
        $task->restore();
    }
}
