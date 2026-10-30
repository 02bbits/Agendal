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

    private const PRIORITY_ORDER = "case priority when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end asc";

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

        $overdueTasks = $this->overdue($today);
        $todayTasks = $this->today($today);
        [$noDateTasks, $noDateCount] = $this->noDate();
        [$completedTasks, $completedCount] = $this->completedToday($today, $zone);

        return [
            'overdue' => TaskResource::collection($overdueTasks)->resolve(),
            'today' => TaskResource::collection($todayTasks)->resolve(),
            'no_date' => TaskResource::collection($noDateTasks)->resolve(),
            'completed_today' => TaskResource::collection($completedTasks)->resolve(),
            'progress' => $this->progress($overdueTasks, $todayTasks, $today, $zone),
            'no_date_count' => $noDateCount,
            'completed_count' => $completedCount,
        ];
    }

    /**
     * @return Collection<int, Task>
     */
    private function overdue(string $today): Collection
    {
        /** @var Collection<int, Task> $tasks */
        $tasks = $this->baseQuery()
            ->where('done', false)
            ->whereNotNull('due_date')
            ->where('due_date', '<', $today)
            ->orderBy('due_date', 'asc')
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return $tasks;
    }

    /**
     * @return Collection<int, Task>
     */
    private function today(string $today): Collection
    {
        /** @var Collection<int, Task> $tasks */
        $tasks = $this->baseQuery()
            ->where('done', false)
            ->where('due_date', $today)
            ->orderByRaw('case when start_time is not null then 0 else 1 end asc')
            ->orderByRaw('start_time asc nulls last')
            ->orderByRaw(self::PRIORITY_ORDER)
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return $tasks;
    }

    /**
     * @return array{0: Collection<int, Task>, 1: int}
     */
    private function noDate(): array
    {
        $query = $this->baseQuery()
            ->where('done', false)
            ->whereNull('due_date')
            ->orderByRaw(self::PRIORITY_ORDER)
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        $count = (clone $query)->count();
        /** @var Collection<int, Task> $tasks */
        $tasks = $query->limit(self::MAX_ITEMS)->get();

        return [$tasks, $count];
    }

    /**
     * @return array{0: Collection<int, Task>, 1: int}
     */
    private function completedToday(string $today, DateTimeZone $zone): array
    {
        $query = $this->completedTodayQuery($today, $zone)
            ->orderBy('done_at', 'desc')
            ->orderBy('id', 'desc');

        $count = (clone $query)->count();
        /** @var Collection<int, Task> $tasks */
        $tasks = $query->limit(self::MAX_ITEMS)->get();

        return [$tasks, $count];
    }

    /**
     * @param  Collection<int, Task>  $overdueTasks
     * @param  Collection<int, Task>  $todayTasks
     * @return array{done: int, total: int}
     */
    private function progress(Collection $overdueTasks, Collection $todayTasks, string $today, DateTimeZone $zone): array
    {
        $done = (clone $this->completedTodayQuery($today, $zone))
            ->whereNotNull('due_date')
            ->where('due_date', '<=', $today)
            ->count();

        $openDueOrOverdue = $overdueTasks->count() + $todayTasks->count();

        return [
            'done' => $done,
            'total' => $openDueOrOverdue + $done,
        ];
    }

    /**
     * @return array{0: DateTimeImmutable, 1: DateTimeImmutable}
     */
    private function completedTodayWindow(string $today, DateTimeZone $zone): array
    {
        $startLocal = new DateTimeImmutable($today.' 00:00:00', $zone);
        $endLocal = $startLocal->modify('+1 day');

        return [
            $startLocal->setTimezone(new DateTimeZone('UTC')),
            $endLocal->setTimezone(new DateTimeZone('UTC')),
        ];
    }

    /**
     * @return Builder<Task>
     */
    private function completedTodayQuery(string $today, DateTimeZone $zone): Builder
    {
        [$utcStart, $utcEnd] = $this->completedTodayWindow($today, $zone);

        return $this->baseQuery()
            ->where('done', true)
            ->where('done_at', '>=', $utcStart)
            ->where('done_at', '<', $utcEnd);
    }

    /**
     * @return Builder<Task>
     */
    private function baseQuery(): Builder
    {
        return Task::query();
    }
}
