<?php

declare(strict_types=1);

namespace App\Services\Sync;

use App\Exceptions\ApiError;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Services\Projects\ProjectPatcher;
use App\Services\Tasks\TaskLifecycle;
use App\Services\Tasks\TaskPatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * `POST /sync/patches` (ADR-004, AP §7-8): queued offline edits, one field each, judged one by one
 * with last write wins per field. A row that isn't the user's, or names a field off the allow-list,
 * is `rejected` and never fails the batch. `at` is clamped to server time + 5 min (SC-17).
 */
final class SyncPatches
{
    /** TK §8 allow-list, plus completion and deletion as fields. */
    public const TASK_FIELDS = [...Task::PATCHABLE, 'done', 'deleted'];

    public function __construct(
        private readonly TaskPatcher $tasks,
        private readonly TaskLifecycle $lifecycle,
        private readonly ProjectPatcher $projects,
    ) {}

    /**
     * @param  list<array{entity: string, id: string, field: string, value: mixed, at: string}>  $patches
     * @return list<array{index: int, status: string, current?: mixed}>
     */
    public function apply(array $patches, string $timezone): array
    {
        $results = [];
        foreach ($patches as $index => $patch) {
            $results[] = ['index' => $index, ...$this->one($patch, $timezone)];
        }

        return $results;
    }

    /**
     * @param  array{entity: string, id: string, field: string, value: mixed, at: string}  $patch
     * @return array{status: string, current?: mixed}
     */
    private function one(array $patch, string $timezone): array
    {
        ['entity' => $entity, 'id' => $id, 'field' => $field, 'value' => $value, 'at' => $at] = $patch;
        $allowed = $entity === 'task' ? self::TASK_FIELDS : Project::PATCHABLE;
        if (! in_array($field, $allowed, true)) {
            return ['status' => 'rejected'];
        }

        return DB::transaction(function () use ($entity, $id, $field, $value, $at, $timezone): array {
            // The owner scope hides other users' rows: they read as missing (SC-10)
            $row = $entity === 'task'
                ? Task::withTrashed()->whereKey($id)->lockForUpdate()->first()
                : Project::query()->whereKey($id)->lockForUpdate()->first();
            if ($row === null) {
                return ['status' => 'rejected'];
            }

            try {
                $applied = $row instanceof Task
                    ? $this->task($row, $field, $value, $at, $timezone)
                    : $this->projects->patch($row, $field, $value, $at);
            } catch (ValidationException|ApiError|HttpException) {
                return ['status' => 'rejected', 'current' => $this->current($row->fresh() ?? $row, $field)];
            }

            $fresh = $row instanceof Task ? Task::withTrashed()->findOrFail($id) : $row->fresh() ?? $row;

            return $applied
                ? ['status' => 'applied']
                : ['status' => 'stale', 'current' => $this->current($fresh, $field)];
        });
    }

    private function task(Task $task, string $field, mixed $value, string $at, string $timezone): bool
    {
        if ($field === 'deleted') {
            return $value === true
                ? $this->lifecycle->delete($task, $at) || $task->trashed()
                : $this->lifecycle->restore($task, $at) || ! $task->trashed();
        }
        // An edit to a deleted task: the delete won (TK-E8, OFF-21)
        if ($task->trashed()) {
            return false;
        }
        if ($field === 'done') {
            $value === true ? $this->lifecycle->complete($task, $at) : $this->lifecycle->reopen($task, $at);

            return $task->refresh()->done === ($value === true);
        }
        // Judged before patching: a later `at` wins even when the value is already there (same title)
        $wins = $this->tasks->isLaterThan($this->tasks->resolveEffectiveAt($at), $task->field_updated_at[$field] ?? null);
        $this->tasks->patch($task, [$field => $value, 'at' => $at], $timezone);

        return $wins;
    }

    private function current(Task|Project $row, string $field): mixed
    {
        if ($field === 'deleted') {
            return $row instanceof Task ? $row->trashed() : $row->deleted_at !== null;
        }

        return $row instanceof Task
            ? (new TaskResource($row))->resolve()[$field]
            : $row->getAttribute($field);
    }
}
