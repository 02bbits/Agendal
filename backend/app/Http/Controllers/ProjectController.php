<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiError;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Services\Clock\ClockInterface;
use App\Services\Projects\ProjectCounts;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public const LIMIT = 50;

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
            $existingWithName = Project::query()
                ->whereNull('deleted_at')
                ->whereRaw('lower(name) = lower(?)', [$name])
                ->first();

            if ($existingWithName) {
                $message = "You already have a project called “{$existingWithName->name}”.";
                throw new ApiError('project.name_taken', $message, 422, ['name' => [$message]]);
            }

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
}
