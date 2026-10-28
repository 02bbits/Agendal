<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\TaskPatcher;
use Illuminate\Http\JsonResponse;
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
            throw ValidationException::withMessages([
                'id' => ['The id has already been taken.'],
            ]);
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

        if (empty($dueDate) && ($startTime !== null || $repeat !== 'never')) {
            $dueDate = $clock->today($timezone);
        }

        // 4. Open limit
        $openCount = Task::where('done', false)->count();
        if ($openCount >= Task::OPEN_LIMIT) {
            throw ValidationException::withMessages([
                'task' => ["You've reached 5,000 open tasks. Complete or delete some to add more."],
            ]);
        }

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
}
