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
use App\Services\Tasks\TaskLifecycle;
use App\Services\Tasks\TaskPatcher;
use App\Services\Tasks\UpcomingQuery;
use App\Support\Stamp;
use Dedoc\Scramble\Attributes\QueryParameter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    /** @response array{overdue: list<TaskResource>, today: list<TaskResource>, no_date: list<TaskResource>, completed_today: list<TaskResource>, progress: array{done: int, total: int}, no_date_count: int, completed_count: int}|array{days: list<array{date: string, tasks: list<TaskResource>}>, next_from: string|null, total_count: int} */
    #[QueryParameter('view', required: true, type: '"inbox"|"upcoming"')]
    #[QueryParameter('from', 'Upcoming: first day, `YYYY-MM-DD`. Default tomorrow.', type: 'string', format: 'date')]
    #[QueryParameter('days', 'Upcoming: days per page.', type: 'int', default: 14)]
    #[QueryParameter('filter', 'Upcoming only.', type: '"all"|"scheduled"|"due"', default: 'all')]
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

    /** @response array{items: list<TaskResource>, counts: array{all: int, open: int, completed: int}, next_cursor: string|null} */
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
        // A repeat with neither date starts today: the start date is a task's main date (#154)
        if (DueDateFallback::needed($dueDate, $startDate, $repeatStr)) {
            $startDate = $today;
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
        $nowIso = Stamp::of($clock->now());
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

        $dueReminder = $request->input('due_reminder', 'none') ?? 'none';
        $dueRemindAt = null;
        if ($dueReminder !== 'none' && ! empty($dueDate)) {
            $dueRemindAt = $reminders->forDueDate($dueDate, $dueTimeStr, $dueReminder, $timezone);
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
        $task->due_reminder = $dueReminder;
        $task->repeat = $repeat;
        $task->repeat_rule = $request->input('repeat_rule');
        $task->notes = $request->input('notes');
        $task->project_id = $projectId;
        // A task made by dropping it on a place (#178) arrives with its keys
        $task->project_order = $request->input('project_order');
        $task->day_order = $request->input('day_order');
        $task->done = false;
        $task->created_by = 'user';
        $task->field_updated_at = $fieldUpdatedAt;
        $task->remind_at = $remindAt;
        $task->due_remind_at = $dueRemindAt;
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

        // Read again under a row lock: two writes at once would each save the stamps they read,
        // and one field's stamp would be lost (ADR-004)
        $updatedTask = DB::transaction(fn (): Task => $patcher->patch(
            Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail(),
            $payload,
            $timezone,
        ));

        return new TaskResource($updatedTask);
    }

    public function complete(TaskLifecycleRequest $request, Task $task, TaskLifecycle $lifecycle): JsonResponse
    {
        $at = is_string($request->input('at')) ? $request->input('at') : null;

        return $this->lifecycleResponse($lifecycle->complete($task, $at));
    }

    public function reopen(TaskLifecycleRequest $request, Task $task, TaskLifecycle $lifecycle): JsonResponse
    {
        $at = is_string($request->input('at')) ? $request->input('at') : null;

        return $this->lifecycleResponse($lifecycle->reopen($task, $at, $request->boolean('merge')));
    }

    /** @param array{task: Task, next: Task|null, withdrawn?: list<Task>, closed?: list<Task>, merged?: bool} $result */
    private function lifecycleResponse(array $result): JsonResponse
    {
        $withdrawn = array_map(fn (Task $task): string => $task->id, $result['withdrawn'] ?? []);
        $closed = $result['closed'] ?? [];

        return response()->json([
            'task' => new TaskResource($result['task']),
            ...($result['next'] === null ? [] : ['next' => new TaskResource($result['next'])]),
            // Reopening a repeating task: the other occurrences that changed with it
            ...($withdrawn === [] ? [] : ['withdrawn' => $withdrawn]),
            ...($closed === [] ? [] : ['closed' => TaskResource::collection($closed)]),
            // Unticked in Completed while its series has an open occurrence: removed, merged into it
            ...(($result['merged'] ?? false) ? ['merged' => true] : []),
        ]);
    }

    public function destroy(
        Request $request,
        Task $task,
        TaskLifecycle $lifecycle,
    ): Response|JsonResponse {
        if ($task->repeat !== 'never') {
            $scope = $request->input('scope');
            if ($scope !== 'one' && $scope !== 'future') {
                throw ValidationException::withMessages([
                    'scope' => ['Choose This task only or This and all future.'],
                ]);
            }
        }

        $result = $lifecycle->deleteScope($task, $request->input('scope'));

        if ($result['next'] !== null) {
            return response()->json(['next' => new TaskResource($result['next'])], 200);
        }

        if (count($result['deleted_ids']) > 1) {
            return response()->json(['deleted_ids' => $result['deleted_ids']], 200);
        }

        return response()->noContent();
    }

    public function restore(Task $task, TaskLifecycle $lifecycle): TaskResource
    {
        $lifecycle->restore($task);
        $task->refresh();

        return new TaskResource($task);
    }
}
