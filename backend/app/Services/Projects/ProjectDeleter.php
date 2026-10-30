<?php

declare(strict_types=1);

namespace App\Services\Projects;

use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use DateTimeZone;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ProjectDeleter
{
    public function __construct(
        private readonly ClockInterface $clock,
    ) {}

    /**
     * @return array{task_ids: list<string>, mode: string}
     */
    public function delete(Project $project, string $mode): array
    {
        /** @var Collection<int, Task> $tasks */
        $tasks = Task::query()->where('project_id', $project->id)->get();

        if ($tasks->isNotEmpty()) {
            if ($mode !== 'move' && $mode !== 'delete') {
                throw ValidationException::withMessages([
                    'tasks' => ['Choose Move tasks to No project or Delete them too.'],
                ]);
            }
        }

        $now = Carbon::instance($this->clock->now());
        $nowIso = $this->clock->now()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');

        return DB::transaction(function () use ($project, $tasks, $mode, $now, $nowIso): array {
            $project->deleted_at = $nowIso;
            $project->updated_at = $now;
            $project->save();

            if ($tasks->isEmpty()) {
                return [
                    'task_ids' => [],
                    'mode' => 'move',
                ];
            }

            if ($mode === 'move') {
                foreach ($tasks as $task) {
                    /** @var array<string, string> $fieldUpdatedAt */
                    $fieldUpdatedAt = $task->field_updated_at ?? [];
                    $fieldUpdatedAt['project_id'] = $nowIso;
                    $task->field_updated_at = $fieldUpdatedAt;
                    $task->project_id = null;
                    $task->updated_at = $now;
                    $task->save();
                }
            } else {
                foreach ($tasks as $task) {
                    /** @var array<string, string> $fieldUpdatedAt */
                    $fieldUpdatedAt = $task->field_updated_at ?? [];
                    $fieldUpdatedAt['deleted'] = $nowIso;
                    $task->field_updated_at = $fieldUpdatedAt;
                    $task->deleted_at = $now;
                    $task->updated_at = $now;
                    $task->save();
                }
            }

            /** @var list<string> $taskIds */
            $taskIds = $tasks->pluck('id')->map(fn ($id): string => (string) $id)->values()->all();

            return [
                'task_ids' => $taskIds,
                'mode' => $mode,
            ];
        });
    }

    /**
     * @param  list<string>  $taskIds
     */
    public function restore(Project $project, array $taskIds, string $mode): Project
    {
        $tasks = $this->resolveAndValidateRestorableTasks($taskIds, $mode, $project);

        $now = Carbon::instance($this->clock->now());
        $nowIso = $this->clock->now()->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');

        return DB::transaction(function () use ($project, $tasks, $mode, $now, $nowIso): Project {
            $project->deleted_at = null;
            $project->updated_at = $now;
            $project->save();

            if ($mode === 'move') {
                foreach ($tasks as $task) {
                    /** @var array<string, string> $fieldUpdatedAt */
                    $fieldUpdatedAt = $task->field_updated_at ?? [];
                    $fieldUpdatedAt['project_id'] = $nowIso;
                    $task->field_updated_at = $fieldUpdatedAt;
                    $task->project_id = $project->id;
                    $task->updated_at = $now;
                    $task->save();
                }
            } else {
                foreach ($tasks as $task) {
                    /** @var array<string, string> $fieldUpdatedAt */
                    $fieldUpdatedAt = $task->field_updated_at ?? [];
                    $fieldUpdatedAt['deleted'] = $nowIso;
                    $task->field_updated_at = $fieldUpdatedAt;
                    $task->deleted_at = null;
                    $task->updated_at = $now;
                    $task->save();
                }
            }

            return $project;
        });
    }

    /**
     * @param  list<string>  $taskIds
     * @return Collection<int, Task>
     */
    private function resolveAndValidateRestorableTasks(array $taskIds, string $mode, Project $project): Collection
    {
        if (empty($taskIds)) {
            return new Collection;
        }

        $uniqueIds = array_values(array_unique($taskIds));
        if (count($uniqueIds) !== count($taskIds)) {
            throw ValidationException::withMessages([
                'task_ids' => ['Task IDs must not contain duplicates.'],
            ]);
        }

        /** @var Collection<int, Task> $tasks */
        $tasks = Task::withTrashed()->whereIn('id', $uniqueIds)->get();

        if ($tasks->count() !== count($uniqueIds)) {
            throw ValidationException::withMessages([
                'task_ids' => ['One or more tasks cannot be restored.'],
            ]);
        }

        foreach ($tasks as $task) {
            if ($mode === 'move') {
                if ($task->trashed() || $task->project_id !== null) {
                    throw ValidationException::withMessages([
                        'task_ids' => ['One or more tasks were not part of this deletion.'],
                    ]);
                }
            } else {
                $projectDeletedAt = $project->deleted_at ? Carbon::parse($project->deleted_at) : null;
                if (! $task->trashed() || ! $task->deleted_at || ! $projectDeletedAt || ! $task->deleted_at->equalTo($projectDeletedAt)) {
                    throw ValidationException::withMessages([
                        'task_ids' => ['One or more tasks were not deleted with this project.'],
                    ]);
                }
            }
        }

        return $tasks;
    }
}
