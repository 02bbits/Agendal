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
use Illuminate\Validation\ValidationException;

final class UpcomingQuery
{
    private const PRIORITY_ORDER = "case priority when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end asc";

    public function __construct(
        private readonly ClockInterface $clock,
    ) {}

    /**
     * @return array{
     *     days: array<int, array{date: string, tasks: array<int, mixed>}>,
     *     next_from: ?string,
     *     total_count: int,
     * }
     */
    public function for(
        string $timezone,
        ?string $from = null,
        int $days = 14,
        string $filter = 'all',
    ): array {
        if (! in_array($filter, ['all', 'scheduled', 'due'], true)) {
            throw ValidationException::withMessages([
                'filter' => ['The selected filter is invalid.'],
            ]);
        }

        try {
            new DateTimeZone($timezone);
        } catch (Exception) {
            $timezone = 'UTC';
        }

        $today = $this->clock->today($timezone);
        $tomorrow = (new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');

        $startDate = $from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) ? $from : $tomorrow;
        $pageDays = max(1, $days);

        $query = Task::query()->where('done', false);

        if ($filter === 'scheduled') {
            $query->where('start_date', '>=', $startDate);
        } elseif ($filter === 'due') {
            $query->where('due_date', '>=', $startDate);
        } else {
            $query->where(fn (Builder $q) => $q->where('due_date', '>=', $startDate)->orWhere('start_date', '>=', $startDate));
        }

        $totalCount = (clone $query)->count();

        /** @var Collection<int, Task> $tasks */
        $tasks = $query
            ->orderByRaw('case when start_time is not null then 0 else 1 end asc')
            ->orderByRaw('start_time asc nulls last')
            ->orderByRaw(self::PRIORITY_ORDER)
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        if ($tasks->isEmpty()) {
            return [
                'days' => [],
                'next_from' => null,
                'total_count' => 0,
            ];
        }

        /** @var array<string, Collection<int, Task>> $byDay */
        $byDay = [];

        foreach ($tasks as $task) {
            $dates = [];
            if ($filter === 'scheduled') {
                if ($task->start_date !== null) {
                    $dates[] = substr((string) $task->start_date, 0, 10);
                }
            } elseif ($filter === 'due') {
                if ($task->due_date !== null) {
                    $dates[] = substr((string) $task->due_date, 0, 10);
                }
            } else {
                if ($task->start_date !== null) {
                    $dates[] = substr((string) $task->start_date, 0, 10);
                }
                if ($task->due_date !== null) {
                    $dates[] = substr((string) $task->due_date, 0, 10);
                }
            }

            $dates = array_values(array_unique($dates));

            foreach ($dates as $date) {
                if ($date >= $startDate) {
                    if (! isset($byDay[$date])) {
                        $byDay[$date] = new Collection;
                    }
                    $byDay[$date]->push($task);
                }
            }
        }

        ksort($byDay);

        if (empty($byDay)) {
            return [
                'days' => [],
                'next_from' => null,
                'total_count' => 0,
            ];
        }

        $firstDate = (string) array_key_first($byDay);
        $lastDate = (new DateTimeImmutable($firstDate))->modify('+'.($pageDays - 1).' days')->format('Y-m-d');

        $daysResult = [];
        $nextFrom = null;

        foreach ($byDay as $date => $dayTasks) {
            if ($date <= $lastDate) {
                $daysResult[] = [
                    'date' => $date,
                    'tasks' => TaskResource::collection($dayTasks)->resolve(),
                ];
            } elseif ($nextFrom === null) {
                $nextFrom = $date;
            }
        }

        return [
            'days' => $daysResult,
            'next_from' => $nextFrom,
            'total_count' => $totalCount,
        ];
    }
}
