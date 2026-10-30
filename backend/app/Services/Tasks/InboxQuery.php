<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use DateTimeZone;
use Exception;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

final class InboxQuery
{
    public const MAX_ITEMS = 200;

    public function __construct(
        private readonly ClockInterface $clock,
    ) {}

    /**
     * @return array{
     *     overdue: array<int, mixed>,
     *     today: array<int, mixed>,
     *     no_date: array<int, mixed>,
     *     completed_today: array<int, mixed>,
     *     progress: array{done: int, total: int},
     *     no_date_count: int,
     *     completed_count: int,
     * }
     */
    public function for(string $timezone): array
    {
        try {
            $zone = new DateTimeZone($timezone);
        } catch (Exception) {
            $zone = new DateTimeZone('UTC');
            $timezone = 'UTC';
        }

        $today = $this->clock->today($timezone);

        /** @var Collection<int, Task> $overdueTasks */
        $overdueTasks = $this->baseQuery()
            ->where('done', false)
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->orderBy('due_date', 'asc')
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        /** @var Collection<int, Task> $todayTasks */
        $todayTasks = $this->baseQuery()
            ->where('done', false)
            ->where('due_date', $today)
            ->orderByRaw('case when start_time is not null then 0 else 1 end asc')
            ->orderByRaw('start_time asc nulls last')
            ->orderByRaw("case priority when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end asc")
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        $noDateQuery = $this->baseQuery()
            ->where('done', false)
            ->whereNull('due_date')
            ->orderByRaw("case priority when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end asc")
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        $noDateCount = (clone $noDateQuery)->count();
        /** @var Collection<int, Task> $noDateTasks */
        $noDateTasks = $noDateQuery->limit(self::MAX_ITEMS)->get();

        $startLocal = new DateTimeImmutable($today.' 00:00:00', $zone);
        $endLocal = $startLocal->modify('+1 day');
        $utcStart = $startLocal->setTimezone(new DateTimeZone('UTC'));
        $utcEnd = $endLocal->setTimezone(new DateTimeZone('UTC'));

        $completedQuery = $this->baseQuery()
            ->where('done', true)
            ->where('done_at', '>=', $utcStart)
            ->where('done_at', '<', $utcEnd)
            ->orderBy('done_at', 'desc')
            ->orderBy('id', 'desc');

        $completedCount = (clone $completedQuery)->count();
        /** @var Collection<int, Task> $completedTasks */
        $completedTasks = $completedQuery->limit(self::MAX_ITEMS)->get();

        $done = (clone $this->baseQuery())
            ->where('done', true)
            ->where('done_at', '>=', $utcStart)
            ->where('done_at', '<', $utcEnd)
            ->whereNotNull('due_date')
            ->where('due_date', '<=', $today)
            ->count();

        $openDueOrOverdue = $overdueTasks->count() + $todayTasks->count();
        $total = $openDueOrOverdue + $done;

        return [
            'overdue' => TaskResource::collection($overdueTasks)->resolve(),
            'today' => TaskResource::collection($todayTasks)->resolve(),
            'no_date' => TaskResource::collection($noDateTasks)->resolve(),
            'completed_today' => TaskResource::collection($completedTasks)->resolve(),
            'progress' => [
                'done' => $done,
                'total' => $total,
            ],
            'no_date_count' => $noDateCount,
            'completed_count' => $completedCount,
        ];
    }

    /**
     * @return Builder<Task>
     */
    private function baseQuery(): Builder
    {
        return Task::query();
    }
}
