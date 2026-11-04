<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\SearchTasksRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\TaskLifecycleRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\DueDateFallback;
use App\Services\Tasks\InboxQuery;
use App\Services\Tasks\OpenTaskLimit;
use App\Services\Tasks\SearchQuery;
use App\Services\Tasks\TaskPatcher;
use App\Services\Tasks\TaskRecurrence;
use App\Services\Tasks\UpcomingQuery;
use DateTimeZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    public function index(
        Request $request,
        InboxQuery $inboxQuery,
        UpcomingQuery $upcomingQuery,
    ): JsonResponse {
        $view = $request->query('view');
        if ($view !== 'inbox' && $view !== 'upcoming') {
            throw ValidationException::withMessages([
                'view' => ['The selected view is invalid.'],
            ]);
        }

        $timezone = (string) $request->attributes->get('timezone', 'UTC');

        if ($view === 'inbox') {
            return response()->json($inboxQuery->for($timezone));
        }

        $from = $request->has('from') && $request->query('from') !== ''
            ? (string) $request->query('from')
            : null;
        $days = $request->has('days')
            ? (int) $request->query('days')
            : 14;
        $filter = (string) $request->query('filter', 'all');

        return response()->json($upcomingQuery->for($timezone, $from, $days, $filter));
    }

    public function search(
        SearchTasksRequest $request,
        SearchQuery $searchQuery,
        ClockInterface $clock,
    ): JsonResponse {
        $user = $request->user();
        assert($user !== null);

        $today = $clock->today(((string) $request->attributes->get('timezone')) ?: 'UTC');

        $projectId = $request->input('project_id');
        if ($projectId !== null) {
            $project = Project::query()
                ->where('user_id', $user->id)
                ->whereNull('deleted_at')
                ->find($projectId);
            if (! $project) {
                abort(404, 'This item no longer exists.');
            }
        }

        $q = (string) $request->input('q', '');
        $status = (string) $request->input('status', 'all');
        $cursor = $request->input('cursor');
        $filter = $request->input('filter');

        return response()->json(
            $searchQuery->search(
                $user->id,
                $q,
                $status,
                is_string($cursor) ? $cursor : null,
                is_string($filter) ? $filter : null,
                is_string($projectId) ? $projectId : null,
                $today,
            )
        );
    }

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

        // 3. Repeat date fallback (times without their day are rejected by the request)
        $timezone = ((string) $request->attributes->get('timezone')) ?: 'UTC';
        $today = $clock->today($timezone);
        $startDateInput = $request->input('start_date');
        $dueDateInput = $request->input('due_date');
        $startTime = $request->input('start_time');
        $dueTime = $request->input('due_time');
        $repeat = $request->input('repeat', 'never') ?? 'never';

        $startDateStr = is_string($startDateInput) ? $startDateInput : null;
        $dueDateStr = is_string($dueDateInput) ? $dueDateInput : null;
        $startTimeStr = is_string($startTime) ? $startTime : null;
        $dueTimeStr = is_string($dueTime) ? $dueTime : null;
        $repeatStr = is_string($repeat) ? $repeat : 'never';

        $startDate = $startDateStr;
        $dueDate = $dueDateStr;
        if (DueDateFallback::needed($dueDate, $startDate, $repeatStr)) {
            $dueDate = $today;
        }

        // Start before due (TK-3)
        if (! empty($startDate) && ! empty($dueDate)) {
            if ($startDate > $dueDate) {
                throw ValidationException::withMessages([
                    'start_date' => ["Start can't be after the due date."],
                ]);
            }
            if ($startDate === $dueDate && $startTimeStr !== null && $dueTimeStr !== null) {
                $st = substr($startTimeStr, 0, 5);
                $dt = substr($dueTimeStr, 0, 5);
                if ($st >= $dt) {
                    throw ValidationException::withMessages([
                        'start_time' => ["Start can't be after the due date."],
                    ]);
                }
            }
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
        if ($reminder !== 'none') {
            $remindAt = $reminders->forDates($startDate, $startTimeStr, $dueDate, $dueTimeStr, $reminder, $timezone);
        }

        $user = $request->user();
        assert($user !== null);

        $task = new Task;
        $task->id = $id;
        $task->user_id = $user->id;
        $task->title = (string) $request->input('title');
        $task->start_date = $startDate;
        $task->due_date = $dueDate;
        $task->start_time = $startTime;
        $task->due_time = $dueTime;
        $task->priority = $request->input('priority');
        $task->reminder = $reminder;
        $task->repeat = $repeat;
        $task->repeat_rule = $request->input('repeat_rule');
        $task->notes = $request->input('notes');
        $task->project_id = $projectId;
        $task->done = false;
        $task->created_by = 'user';
        $task->field_updated_at = $fieldUpdatedAt;
        $task->remind_at = $remindAt;
        if ($repeat !== 'never' && (! empty($startDate) || ! empty($dueDate))) {
            $task->repeat_anchor = $startDate ?: $dueDate;
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
        TaskRecurrence $recurrence,
    ): JsonResponse {
        $at = $request->has('at') && is_string($request->input('at')) ? $request->input('at') : null;

        return DB::transaction(function () use ($task, $patcher, $recurrence, $at): JsonResponse {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $wasDone = $locked->done;
            $updatedTask = $patcher->complete($locked, $at);
            $next = $updatedTask->done ? $recurrence->next($updatedTask, restoreDeleted: ! $wasDone) : null;
            if ($next?->trashed()) {
                $next = null;
            }

            return response()->json(['task' => new TaskResource($updatedTask), ...($next === null ? [] : ['next' => new TaskResource($next)])]);
        });
    }

    public function reopen(
        TaskLifecycleRequest $request,
        Task $task,
        TaskPatcher $patcher,
    ): JsonResponse {
        $at = $request->has('at') && is_string($request->input('at')) ? $request->input('at') : null;

        return DB::transaction(function () use ($task, $patcher, $at): JsonResponse {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $wasDone = $locked->done;
            $updatedTask = $patcher->reopen($locked, $at);
            $next = null;
            if (! $updatedTask->done) {
                $child = Task::withTrashed()->where('previous_occurrence_id', $task->id)->lockForUpdate()->first();
                if ($child !== null && ! $child->done) {
                    if (! $child->trashed()) {
                        $fields = $child->field_updated_at;
                        $fields['deleted'] = $patcher->resolveEffectiveAt($at)->format(DATE_ATOM);
                        $child->field_updated_at = $fields;
                        $child->delete();
                    }
                    $next = $child;
                }
                if ($wasDone) {
                    OpenTaskLimit::ensureRoom(additional: 0);
                }
            }

            return response()->json(['task' => new TaskResource($updatedTask), ...($next === null ? [] : ['next' => new TaskResource($next)])]);
        });
    }

    public function destroy(
        Request $request,
        Task $task,
        ClockInterface $clock,
        TaskRecurrence $recurrence,
    ): Response|JsonResponse {
        if ($task->repeat !== 'never') {
            $scope = $request->input('scope');
            if ($scope !== 'one' && $scope !== 'future') {
                throw ValidationException::withMessages([
                    'scope' => ['Choose This task only or This and all future.'],
                ]);
            }
        }

        return DB::transaction(function () use ($task, $request, $clock, $recurrence): Response|JsonResponse {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $scope = $request->input('scope');
            $next = null;
            if ($scope === 'one' && ! $locked->done) {
                $next = $recurrence->next($locked, restoreDeleted: true);
                if ($next?->trashed()) {
                    $next = null;
                }
            }

            $now = $clock->now()->setTimezone(new DateTimeZone('UTC'));
            /** @var array<string, string> $fieldUpdatedAt */
            $fieldUpdatedAt = $locked->field_updated_at ?? [];
            $fieldUpdatedAt['deleted'] = $now->format('Y-m-d\TH:i:s\Z');
            $locked->field_updated_at = $fieldUpdatedAt;
            $locked->save();
            $locked->delete();

            if ($next !== null) {
                return response()->json(['next' => new TaskResource($next)], 200);
            }

            return response()->noContent();
        });
    }

    public function restore(
        Task $task,
        ClockInterface $clock,
    ): TaskResource {
        return DB::transaction(function () use ($task, $clock): TaskResource {
            $locked = Task::withTrashed()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($locked->trashed()) {
                if (! $locked->done) {
                    $child = Task::withTrashed()
                        ->where('previous_occurrence_id', $locked->id)
                        ->lockForUpdate()
                        ->first();
                    if ($child !== null && ! $child->done && ! $child->trashed()) {
                        $now = $clock->now()->setTimezone(new DateTimeZone('UTC'));
                        /** @var array<string, string> $childFieldUpdatedAt */
                        $childFieldUpdatedAt = $child->field_updated_at ?? [];
                        $childFieldUpdatedAt['deleted'] = $now->format('Y-m-d\TH:i:s\Z');
                        $child->field_updated_at = $childFieldUpdatedAt;
                        $child->save();
                        $child->delete();
                    }
                    OpenTaskLimit::ensureRoom();
                }

                $now = $clock->now()->setTimezone(new DateTimeZone('UTC'));
                /** @var array<string, string> $fieldUpdatedAt */
                $fieldUpdatedAt = $locked->field_updated_at ?? [];
                $fieldUpdatedAt['deleted'] = $now->format('Y-m-d\TH:i:s\Z');
                $locked->field_updated_at = $fieldUpdatedAt;
                $locked->save();
                $locked->restore();
            }

            return new TaskResource($locked);
        });
    }
}
