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

    public function countFor(string $timezone, ?string $from = null, string $filter = 'all'): int
    {
        $this->assertValidFilter($filter);
        $startDate = $this->resolveStartDate($timezone, $from);

        return $this->filteredQuery($startDate, $filter)->count();
    }

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
        $this->assertValidFilter($filter);

        $startDate = $this->resolveStartDate($timezone, $from);
        $pageDays = max(1, $days);

        $query = $this->filteredQuery($startDate, $filter);

        $totalCount = (clone $query)->count();
        if ($totalCount === 0) {
            return [
                'days' => [],
                'next_from' => null,
                'total_count' => 0,
            ];
        }

        $firstDate = $this->findMinDate($query, $startDate, $filter);
        if ($firstDate === null) {
            return [
                'days' => [],
                'next_from' => null,
                'total_count' => 0,
            ];
        }

        $lastDate = (new DateTimeImmutable($firstDate))->modify('+'.($pageDays - 1).' days')->format('Y-m-d');
        $windowQuery = $this->applyWindowFilter(clone $query, $startDate, $lastDate, $filter);

        /** @var Collection<int, Task> $tasks */
        $tasks = $windowQuery
            ->orderByRaw('case when start_time is not null then 0 else 1 end asc')
            ->orderByRaw('start_time asc nulls last')
            ->orderByRaw(self::PRIORITY_ORDER)
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        /** @var array<string, Collection<int, Task>> $byDay */
        $byDay = [];

        foreach ($tasks as $task) {
            $dates = [];
            if ($filter === 'scheduled') {
                if ($task->start_date !== null) {
                    $dates[] = substr((string) $task->start_date, 0, 10);
                } elseif ($task->repeat !== 'never' && $task->due_date !== null) {
                    $dates[] = substr((string) $task->due_date, 0, 10);
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
                if ($date >= $startDate && $date <= $lastDate) {
                    if (! isset($byDay[$date])) {
                        $byDay[$date] = new Collection;
                    }
                    $byDay[$date]->push($task);
                }
            }
        }

        ksort($byDay);

        $daysResult = [];
        foreach ($byDay as $date => $dayTasks) {
            $daysResult[] = [
                'date' => $date,
                'tasks' => TaskResource::collection($dayTasks)->resolve(),
            ];
        }

        $nextFrom = $this->findNextDate($query, $lastDate, $filter);

        return [
            'days' => $daysResult,
            'next_from' => $nextFrom,
            'total_count' => $totalCount,
        ];
    }

    private function assertValidFilter(string $filter): void
    {
        if (! in_array($filter, ['all', 'scheduled', 'due'], true)) {
            throw ValidationException::withMessages([
                'filter' => ['The selected filter is invalid.'],
            ]);
        }
    }

    private function resolveStartDate(string $timezone, ?string $from = null): string
    {
        try {
            new DateTimeZone($timezone);
        } catch (Exception) {
            $timezone = 'UTC';
        }

        $today = $this->clock->today($timezone);
        $tomorrow = (new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');

        return $from && preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) ? $from : $tomorrow;
    }

    /**
     * @return Builder<Task>
     */
    private function filteredQuery(string $startDate, string $filter): Builder
    {
        $query = Task::query()->where('done', false);

        if ($filter === 'scheduled') {
            $query->where(function (Builder $q) use ($startDate): void {
                $q->where('start_date', '>=', $startDate)
                    ->orWhere(function (Builder $q2) use ($startDate): void {
                        $q2->whereNull('start_date')
                            ->where('repeat', '<>', 'never')
                            ->where('due_date', '>=', $startDate);
                    });
            });
        } elseif ($filter === 'due') {
            $query->where('due_date', '>=', $startDate);
        } else {
            $query->where(fn (Builder $q) => $q->where('due_date', '>=', $startDate)->orWhere('start_date', '>=', $startDate));
        }

        return $query;
    }

    /**
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    private function applyWindowFilter(Builder $query, string $startDate, string $lastDate, string $filter): Builder
    {
        if ($filter === 'scheduled') {
            return $query->whereRaw('coalesce(start_date, due_date) <= ?', [$lastDate]);
        }

        if ($filter === 'due') {
            return $query->where('due_date', '<=', $lastDate);
        }

        return $query->where(function (Builder $q) use ($startDate, $lastDate): void {
            $q->where(fn (Builder $s) => $s->where('start_date', '>=', $startDate)->where('start_date', '<=', $lastDate))
                ->orWhere(fn (Builder $d) => $d->where('due_date', '>=', $startDate)->where('due_date', '<=', $lastDate));
        });
    }

    /**
     * @param  Builder<Task>  $query
     */
    private function findMinDate(Builder $query, string $startDate, string $filter): ?string
    {
        if ($filter === 'scheduled') {
            $min = (clone $query)->selectRaw('min(coalesce(start_date, due_date)) as min_date')->value('min_date');

            return is_string($min) && $min !== '' ? substr($min, 0, 10) : null;
        }

        if ($filter === 'due') {
            $min = (clone $query)->min('due_date');

            return is_string($min) && $min !== '' ? substr($min, 0, 10) : null;
        }

        $row = (clone $query)
            ->selectRaw(
                'min(case when start_date >= ? then start_date end) as min_start, min(case when due_date >= ? then due_date end) as min_due',
                [$startDate, $startDate]
            )
            ->toBase()
            ->first();

        return $this->pickEarlierDate($row->min_start ?? null, $row->min_due ?? null);
    }

    /**
     * @param  Builder<Task>  $query
     */
    private function findNextDate(Builder $query, string $lastDate, string $filter): ?string
    {
        if ($filter === 'scheduled') {
            $next = (clone $query)
                ->whereRaw('coalesce(start_date, due_date) > ?', [$lastDate])
                ->selectRaw('min(coalesce(start_date, due_date)) as next_date')
                ->value('next_date');

            return is_string($next) && $next !== '' ? substr($next, 0, 10) : null;
        }

        if ($filter === 'due') {
            $next = (clone $query)->where('due_date', '>', $lastDate)->min('due_date');

            return is_string($next) && $next !== '' ? substr($next, 0, 10) : null;
        }

        $row = (clone $query)
            ->where(fn (Builder $q) => $q->where('start_date', '>', $lastDate)->orWhere('due_date', '>', $lastDate))
            ->selectRaw(
                'min(case when start_date > ? then start_date end) as next_start, min(case when due_date > ? then due_date end) as next_due',
                [$lastDate, $lastDate]
            )
            ->toBase()
            ->first();

        return $this->pickEarlierDate($row->next_start ?? null, $row->next_due ?? null);
    }

    private function pickEarlierDate(mixed $first, mixed $second): ?string
    {
        $candidates = array_filter(
            [$first, $second],
            static fn (mixed $value): bool => is_string($value) && $value !== ''
        );

        if ($candidates === []) {
            return null;
        }

        $dates = array_map(static fn (string $value): string => substr($value, 0, 10), $candidates);
        sort($dates);

        return $dates[0];
    }
}
