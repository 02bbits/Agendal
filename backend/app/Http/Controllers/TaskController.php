<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\TaskLifecycleRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\DueDateFallback;
use App\Services\Tasks\OpenTaskLimit;
use App\Services\Tasks\TaskPatcher;
use DateTimeZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    public function store(
        StoreTaskRequest $request,
        ClockInterface $clock,
        ReminderCalculator $reminders,
    ): TaskResource|JsonResponse {
        $id = (string) $request->input('id');

        // 1. Replay (ADR-003 idempotency)
        $existing = Task::withTrashed()->where('id', $id)->first();
        if ($existing) {
            return (new TaskResource($existing))->response()->setStatusCode(200);
        }

        if (Task::withoutGlobalScope('owner')->withTrashed()->whereKey($id)->exists()) {
            abort(404, 'This item no longer exists.');
        }

        // 2. Project ownership
        $projectId = $request->input('project_id');
        if ($projectId !== null) {
            $project = Project::query()->whereNull('deleted_at')->find($projectId);
            if (! $project) {
                abort(404, 'This item no longer exists.');
            }
        }

        // 3. Due date fallback
        $timezone = (string) $request->attributes->get('timezone', 'UTC');
        $dueDate = $request->input('due_date');
        $startTime = $request->input('start_time');
        $repeat = $request->input('repeat', 'never') ?? 'never';

        $dueDateStr = is_string($dueDate) ? $dueDate : null;
        $startTimeStr = is_string($startTime) ? $startTime : null;
        $repeatStr = is_string($repeat) ? $repeat : 'never';

        if (DueDateFallback::needed($dueDateStr, $startTimeStr, $repeatStr)) {
            $dueDate = $clock->today($timezone);
        }

        // 4. Open limit
        OpenTaskLimit::ensureRoom();

        // 5. Field updated at & create
        $nowIso = $clock->now()->format('Y-m-d\TH:i:s\Z');
        $fieldUpdatedAt = [];
        foreach ([...Task::PATCHABLE, 'done', 'deleted'] as $field) {
            $fieldUpdatedAt[$field] = $nowIso;
        }

        // 6. Reminders
        $reminder = $request->input('reminder', 'none') ?? 'none';
        $remindAt = null;
        if (! empty($dueDate) && $reminder !== 'none') {
            $remindAt = $reminders->compute($dueDate, $startTime, $reminder, $timezone);
        }

        $user = $request->user();
        assert($user !== null);

        $task = new Task;
        $task->id = $id;
        $task->user_id = $user->id;
        $task->title = (string) $request->input('title');
        $task->due_date = $dueDate;
        $task->start_time = $startTime;
        $task->end_time = $request->input('end_time');
        $task->priority = $request->input('priority');
        $task->reminder = $reminder;
        $task->repeat = $repeat;
        $task->notes = $request->input('notes');
        $task->project_id = $projectId;
        $task->done = false;
        $task->created_by = 'user';
        $task->field_updated_at = $fieldUpdatedAt;
        $task->remind_at = $remindAt;
        if ($repeat !== 'never' && ! empty($dueDate)) {
            $task->repeat_anchor = $dueDate;
        }
        $task->save();

        // 7. Respond 201 with TaskResource
        return (new TaskResource($task))->response()->setStatusCode(201);
    }

    public function show(Task $task): TaskResource
    {
        return new TaskResource($task);
    }

    public function update(
        UpdateTaskRequest $request,
        Task $task,
        TaskPatcher $patcher,
    ): TaskResource {
        $timezone = (string) $request->attributes->get('timezone', 'UTC');
        $payload = $request->isJson() ? (array) $request->json()->all() : $request->all();

        $updatedTask = $patcher->patch($task, $payload, $timezone);

        return new TaskResource($updatedTask);
    }

    public function complete(
        TaskLifecycleRequest $request,
        Task $task,
        TaskPatcher $patcher,
    ): JsonResponse {
        $at = $request->has('at') && is_string($request->input('at')) ? $request->input('at') : null;
        $updatedTask = $patcher->complete($task, $at);

        return response()->json(['task' => new TaskResource($updatedTask)]);
    }

    public function reopen(
        TaskLifecycleRequest $request,
        Task $task,
        TaskPatcher $patcher,
    ): JsonResponse {
        if ($task->done) {
            OpenTaskLimit::ensureRoom();
        }

        $at = $request->has('at') && is_string($request->input('at')) ? $request->input('at') : null;
        $updatedTask = $patcher->reopen($task, $at);

        return response()->json(['task' => new TaskResource($updatedTask)]);
    }

    public function destroy(
        Request $request,
        Task $task,
        ClockInterface $clock,
    ): Response {
        if ($task->repeat !== 'never') {
            $scope = $request->input('scope');
            if ($scope === 'future') {
                throw ValidationException::withMessages([
                    'scope' => ["This and all future isn't available yet."],
                ]);
            }

            if ($scope !== 'one') {
                throw ValidationException::withMessages([
                    'scope' => ['Choose This task only or This and all future.'],
                ]);
            }
        }

        $now = $clock->now()->setTimezone(new DateTimeZone('UTC'));
        /** @var array<string, string> $fieldUpdatedAt */
        $fieldUpdatedAt = $task->field_updated_at ?? [];
        $fieldUpdatedAt['deleted'] = $now->format('Y-m-d\TH:i:s\Z');
        $task->field_updated_at = $fieldUpdatedAt;
        $task->save();
        $task->delete();

        return response()->noContent();
    }

    public function restore(
        Task $task,
        ClockInterface $clock,
    ): TaskResource {
        if ($task->trashed()) {
            if (! $task->done) {
                OpenTaskLimit::ensureRoom();
            }

            $now = $clock->now()->setTimezone(new DateTimeZone('UTC'));
            /** @var array<string, string> $fieldUpdatedAt */
            $fieldUpdatedAt = $task->field_updated_at ?? [];
            $fieldUpdatedAt['deleted'] = $now->format('Y-m-d\TH:i:s\Z');
            $task->field_updated_at = $fieldUpdatedAt;
            $task->restore();
        }

        return new TaskResource($task);
    }
}
