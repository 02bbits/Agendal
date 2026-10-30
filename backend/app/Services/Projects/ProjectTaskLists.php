<?php

declare(strict_types=1);

namespace App\Services\Projects;

use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use Carbon\Carbon;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Collection;

final class ProjectTaskLists
{
    public const COMPLETED_INITIAL_LIMIT = 10;

    public const COMPLETED_PAGE_LIMIT = 50;

    public function __construct(
        private readonly ProjectCounts $projectCounts,
    ) {}

    /**
     * @return array{
     *     progress: array{done: int, total: int},
     *     open: array<int, mixed>,
     *     completed: array<int, mixed>,
     *     next_cursor: string|null,
     * }
     */
    public function build(Project $project, ?string $cursor = null): array
    {
        $this->projectCounts->load(collect([$project]));
        $openCount = (int) $project->getAttribute('open');
        $doneCount = (int) $project->getAttribute('done');

        /** @var Collection<int, Task> $openTasks */
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

        $hasCursor = is_string($cursor) && $cursor !== '';
        if ($hasCursor) {
            $cursorData = $this->decodeCursor($cursor);
            if ($cursorData !== null) {
                [$cursorDoneAt, $cursorId] = $cursorData;
                $completedQuery->where(function ($q) use ($cursorDoneAt, $cursorId): void {
                    $q->where('done_at', '<', $cursorDoneAt)
                        ->orWhere(function ($q2) use ($cursorDoneAt, $cursorId): void {
                            $q2->where('done_at', '=', $cursorDoneAt)
                                ->where('id', '<', $cursorId);
                        });
                });
            }
        }

        $limit = $hasCursor ? self::COMPLETED_PAGE_LIMIT : self::COMPLETED_INITIAL_LIMIT;
        /** @var Collection<int, Task> $completedTasks */
        $completedTasks = $completedQuery->limit($limit + 1)->get();

        $nextCursor = null;
        if ($completedTasks->count() > $limit) {
            $completedTasks = $completedTasks->slice(0, $limit);
            $lastTask = $completedTasks->last();
            assert($lastTask !== null);
            $nextCursor = $this->encodeCursor($lastTask);
        }

        return [
            'progress' => [
                'done' => $doneCount,
                'total' => $openCount + $doneCount,
            ],
            'open' => TaskResource::collection($openTasks)->resolve(),
            'completed' => TaskResource::collection($completedTasks)->resolve(),
            'next_cursor' => $nextCursor,
        ];
    }

    /**
     * @return array{0: Carbon, 1: string}|null
     */
    private function decodeCursor(?string $cursor): ?array
    {
        if (! is_string($cursor) || $cursor === '') {
            return null;
        }

        $decoded = base64_decode($cursor, true);
        if ($decoded === false || ! str_contains($decoded, '|')) {
            return null;
        }

        [$cursorDoneAtStr, $cursorId] = explode('|', $decoded, 2);

        try {
            return [Carbon::parse($cursorDoneAtStr), $cursorId];
        } catch (\Throwable) {
            return null;
        }
    }

    private function encodeCursor(Task $task): string
    {
        $doneAt = $task->done_at ?? $task->created_at;
        $doneAtStr = $doneAt instanceof DateTimeInterface ? $doneAt->format('Y-m-d\TH:i:s.u\Z') : (string) $doneAt;

        return base64_encode("{$doneAtStr}|{$task->id}");
    }
}
