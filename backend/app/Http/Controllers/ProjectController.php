<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Http\Requests\RestoreProjectRequest;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Services\Clock\ClockInterface;
use App\Services\Projects\ProjectCounts;
use App\Services\Projects\ProjectDeleter;
use App\Services\Projects\ProjectTaskLists;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public const LIMIT = 50;

    public function __construct(
        private readonly ProjectCounts $projectCounts,
        private readonly ProjectTaskLists $projectTaskLists,
        private readonly ProjectDeleter $projectDeleter,
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

        $cursor = $request->query('cursor');
        $taskLists = $this->projectTaskLists->build($project, is_string($cursor) ? $cursor : null);

        return response()->json([
            'project' => (new ProjectResource($project))->resolve(),
            ...$taskLists,
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

    public function destroy(
        Request $request,
        Project $project,
    ): JsonResponse {
        $this->ensureNotDeleted($project);

        $undo = $this->projectDeleter->delete($project, (string) $request->query('tasks', ''));

        return response()->json(['undo' => $undo]);
    }

    public function restore(
        RestoreProjectRequest $request,
        string $id,
    ): JsonResponse {
        $project = Project::query()->find($id);
        if (! $project) {
            abort(404, 'This item no longer exists.');
        }

        if ($project->deleted_at === null) {
            $this->projectCounts->load(collect([$project]));

            /** @var JsonResponse $response */
            $response = (new ProjectResource($project))->response();

            return $response->setStatusCode(200);
        }

        /** @var list<string> $taskIds */
        $taskIds = (array) $request->input('task_ids', []);
        $mode = (string) $request->input('mode');

        $this->ensureNameAvailable((string) $project->name, (string) $project->id);

        $project = $this->projectDeleter->restore($project, $taskIds, $mode);

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
