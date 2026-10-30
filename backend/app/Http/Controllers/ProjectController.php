<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use App\Services\Projects\ProjectCounts;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public const LIMIT = 50;

    public const COMPLETED_INITIAL_LIMIT = 10;

    public const COMPLETED_PAGE_LIMIT = 50;

    public function __construct(
        private readonly ProjectCounts $projectCounts,
    ) {}

    public function index(): JsonResponse
    {
        $projects = Project::query()
            ->whereNull('deleted_at')
            ->orderByRaw('lower(name) asc')
            ->get();

        $this->projectCounts->load($projects);

        return response()->json(ProjectResource::collection($projects)->resolve());
    }

    public function store(
        StoreProjectRequest $request,
        ClockInterface $clock,
    ): JsonResponse {
        $id = (string) $request->input('id');

        // 1. Replay (ADR-003 idempotency)
        $existing = Project::where('id', $id)->first();
        if ($existing) {
            $this->projectCounts->load(collect([$existing]));

            /** @var JsonResponse $response */
            $response = (new ProjectResource($existing))->response();

            return $response->setStatusCode(200);
        }

        if (Project::withoutGlobalScope('owner')->whereKey($id)->exists()) {
            abort(404, 'This item no longer exists.');
        }

        $name = (string) $request->input('name');
        $colour = (string) $request->input('colour');
        $user = $request->user();
        assert($user !== null);

        return DB::transaction(function () use ($id, $name, $colour, $user, $clock): JsonResponse {
            $this->ensureNameAvailable($name);

            $count = Project::query()->whereNull('deleted_at')->count();
            if ($count >= self::LIMIT) {
                throw new ApiError('project.limit', 'You can have up to 50 projects.', 422);
            }

            $project = new Project;
            $project->id = $id;
            $project->user_id = $user->id;
            $project->name = $name;
            $project->colour = $colour;
            $project->created_at = Carbon::instance($clock->now());
            $project->updated_at = Carbon::instance($clock->now());
            $project->save();

            $project->setAttribute('open', 0);
            $project->setAttribute('done', 0);

            /** @var JsonResponse $response */
            $response = (new ProjectResource($project))->response();

            return $response->setStatusCode(201);
        });
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $this->ensureNotDeleted($project);

        $this->projectCounts->load(collect([$project]));
        $openCount = (int) $project->getAttribute('open');
        $doneCount = (int) $project->getAttribute('done');

        $openTasks = Task::query()
            ->where('project_id', $project->id)
            ->where('done', false)
            ->orderByRaw('due_date asc nulls last')
            ->orderByRaw("case priority when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end asc")
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $completedQuery = Task::query()
            ->where('project_id', $project->id)
            ->where('done', true)
            ->orderBy('done_at', 'desc')
            ->orderBy('id', 'desc');

        $cursor = $request->query('cursor');
        $hasCursor = is_string($cursor) && $cursor !== '';
        if ($hasCursor) {
            $decoded = base64_decode((string) $cursor, true);
            if ($decoded !== false && str_contains($decoded, '|')) {
                [$cursorDoneAtStr, $cursorId] = explode('|', $decoded, 2);
                try {
                    $cursorDoneAt = Carbon::parse($cursorDoneAtStr);
                    $completedQuery->where(function ($q) use ($cursorDoneAt, $cursorId): void {
                        $q->where('done_at', '<', $cursorDoneAt)
                            ->orWhere(function ($q2) use ($cursorDoneAt, $cursorId): void {
                                $q2->where('done_at', '=', $cursorDoneAt)
                                    ->where('id', '<', $cursorId);
                            });
                    });
                } catch (\Throwable) {
                    // ignore malformed cursor timestamp
                }
            }
        }

        $limit = $hasCursor ? self::COMPLETED_PAGE_LIMIT : self::COMPLETED_INITIAL_LIMIT;
        $completedTasks = $completedQuery->limit($limit + 1)->get();

        $nextCursor = null;
        if ($completedTasks->count() > $limit) {
            $completedTasks = $completedTasks->slice(0, $limit);
            $lastTask = $completedTasks->last();
            assert($lastTask !== null);
            $doneAt = $lastTask->done_at ?? $lastTask->created_at;
            $doneAtStr = $doneAt ? $doneAt->format('Y-m-d\TH:i:s.u\Z') : '';
            $nextCursor = base64_encode("{$doneAtStr}|{$lastTask->id}");
        }

        return response()->json([
            'project' => (new ProjectResource($project))->resolve(),
            'progress' => [
                'done' => $doneCount,
                'total' => $openCount + $doneCount,
            ],
            'open' => TaskResource::collection($openTasks)->resolve(),
            'completed' => TaskResource::collection($completedTasks)->resolve(),
            'next_cursor' => $nextCursor,
        ]);
    }

    public function update(
        UpdateProjectRequest $request,
        Project $project,
        ClockInterface $clock,
    ): JsonResponse {
        $this->ensureNotDeleted($project);

        if ($request->has('name')) {
            $name = (string) $request->input('name');
            $this->ensureNameAvailable($name, (string) $project->id);
            $project->name = $name;
        }

        if ($request->has('colour')) {
            $project->colour = (string) $request->input('colour');
        }

        $project->updated_at = Carbon::instance($clock->now());
        $project->save();

        $this->projectCounts->load(collect([$project]));

        /** @var JsonResponse $response */
        $response = (new ProjectResource($project))->response();

        return $response->setStatusCode(200);
    }

    private function ensureNotDeleted(Project $project): void
    {
        if ($project->deleted_at !== null) {
            abort(404, 'This item no longer exists.');
        }
    }

    private function ensureNameAvailable(string $name, ?string $ignoreProjectId = null): void
    {
        $query = Project::query()
            ->whereNull('deleted_at')
            ->whereRaw('lower(name) = lower(?)', [$name]);

        if ($ignoreProjectId !== null) {
            $query->whereKeyNot($ignoreProjectId);
        }

        $existingWithName = $query->first();

        if ($existingWithName) {
            $message = "You already have a project called “{$existingWithName->name}”.";
            throw new ApiError('project.name_taken', $message, 422, ['name' => [$message]]);
        }
    }
}
