<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use DateTimeZone;
use Exception;
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

        $query = Task::query()
            ->where('done', false)
            ->whereNotNull('due_date')
            ->where('due_date', '>=', $startDate);

        if ($filter === 'scheduled') {
            $query->whereNotNull('start_time');
        } elseif ($filter === 'due') {
            $query->whereNull('start_time');
        }

        $totalCount = (clone $query)->count();

        /** @var Collection<int, Task> $tasks */
        $tasks = $query
            ->orderBy('due_date', 'asc')
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

        $firstDate = substr((string) $tasks->first()->due_date, 0, 10);
        $lastDate = (new DateTimeImmutable($firstDate))->modify('+'.($pageDays - 1).' days')->format('Y-m-d');

        /** @var array<string, Collection<int, Task>> $byDay */
        $byDay = [];
        $nextFrom = null;

        foreach ($tasks as $task) {
            $dueDate = substr((string) $task->due_date, 0, 10);
            if ($dueDate > $lastDate) {
                if ($nextFrom === null) {
                    $nextFrom = $dueDate;
                }
                break;
            }

            if (! isset($byDay[$dueDate])) {
                $byDay[$dueDate] = new Collection;
            }
            $byDay[$dueDate]->push($task);
        }

        $daysResult = [];
        foreach ($byDay as $date => $dayTasks) {
            $daysResult[] = [
                'date' => $date,
                'tasks' => TaskResource::collection($dayTasks)->resolve(),
            ];
        }

        return [
            'days' => $daysResult,
            'next_from' => $nextFrom,
            'total_count' => $totalCount,
        ];
    }
}
