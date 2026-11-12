<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Models\Task;
use Illuminate\Support\Facades\DB;

/**
 * Completion and deletion as fields (ADR-004): the REST endpoints and `POST /sync/patches` both
 * come through here. A sync patch carries its `at` and only wins when it is later than the field's
 * stamp; a REST call (`at` null for delete/restore) is the server's own "now".
 */
final class TaskLifecycle
{
    public function __construct(
        private readonly TaskPatcher $patcher,
        private readonly TaskRecurrence $recurrence,
    ) {}

    /** @return array{task: Task, next: Task|null} */
    public function complete(Task $task, ?string $at): array
    {
        return DB::transaction(function () use ($task, $at): array {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $wasDone = $locked->done;
            $updated = $this->patcher->complete($locked, $at);
            // The next occurrence is made once: `previous_occurrence_id` is unique (TK-E7, OFF-20)
            $next = $updated->done ? $this->recurrence->next($updated, restoreDeleted: ! $wasDone) : null;

            return ['task' => $updated, 'next' => $next?->trashed() ? null : $next];
        });
    }

    /** @return array{task: Task, next: Task|null} */
    public function reopen(Task $task, ?string $at): array
    {
        return DB::transaction(function () use ($task, $at): array {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $wasDone = $locked->done;
            $updated = $this->patcher->reopen($locked, $at);
            $next = null;
            if (! $updated->done) {
                $child = Task::withTrashed()->where('previous_occurrence_id', $task->id)->lockForUpdate()->first();
                if ($child !== null && ! $child->done) {
                    if (! $child->trashed()) {
                        $fields = $child->field_updated_at;
                        $fields['deleted'] = $this->patcher->resolveEffectiveAt($at)->format(DATE_ATOM);
                        $child->field_updated_at = $fields;
                        $child->delete();
                    }
                    $next = $child;
                }
                if ($wasDone) {
                    OpenTaskLimit::ensureRoom(additional: 0);
                }
            }

            return ['task' => $updated, 'next' => $next];
        });
    }

    /** Soft delete. False when a later `deleted` stamp already won. */
    public function delete(Task $task, ?string $at = null): bool
    {
        if ($task->trashed() || ! $this->wins($task, $at)) {
            return false;
        }
        $this->stamp($task, $at);
        $task->save();
        $task->delete();

        return true;
    }

    /** Undoes a delete. False when a later `deleted` stamp already won. */
    public function restore(Task $task, ?string $at = null): bool
    {
        if (! $task->trashed() || ! $this->wins($task, $at)) {
            return false;
        }
        if (! $task->done) {
            OpenTaskLimit::ensureRoom();
        }
        $this->stamp($task, $at);
        $task->restore();

        return true;
    }

    private function wins(Task $task, ?string $at): bool
    {
        return $at === null
            || $this->patcher->isLaterThan($this->patcher->resolveEffectiveAt($at), $task->field_updated_at['deleted'] ?? null);
    }

    private function stamp(Task $task, ?string $at): void
    {
        $fields = $task->field_updated_at ?? [];
        $fields['deleted'] = $this->patcher->resolveEffectiveAt($at)->format('Y-m-d\TH:i:s\Z');
        $task->field_updated_at = $fields;
    }
}
