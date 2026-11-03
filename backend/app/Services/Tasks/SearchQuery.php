<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

final class SearchQuery
{
    public const PAGE_SIZE = 50;

    public const QUERY_MAX = 100;

    /**
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     counts: array{all: int, open: int, completed: int},
     *     next_cursor: string|null
     * }
     */
    public function search(int $userId, string $rawQuery, string $status = 'all', ?string $cursor = null): array
    {
        if (! in_array($status, ['all', 'open', 'completed'], true)) {
            throw ValidationException::withMessages([
                'status' => ['The selected status is invalid.'],
            ]);
        }

        $queryStr = trim(mb_substr($rawQuery, 0, self::QUERY_MAX));
        if ($queryStr === '') {
            return [
                'items' => [],
                'counts' => [
                    'all' => 0,
                    'open' => 0,
                    'completed' => 0,
                ],
                'next_cursor' => null,
            ];
        }

        /** @var list<string> $words */
        $words = preg_split('/\s+/', $queryStr, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($words === []) {
            return [
                'items' => [],
                'counts' => [
                    'all' => 0,
                    'open' => 0,
                    'completed' => 0,
                ],
                'next_cursor' => null,
            ];
        }

        // Base query for matched tasks
        $base = Task::query()
            ->where('user_id', $userId)
            ->whereNull('deleted_at');

        // Escape LIKE wildcards: !, %, _
        $patterns = array_map(
            fn (string $w): string => '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $w).'%',
            $words
        );

        // Every word must match either title or notes (accent- and case-insensitive)
        foreach ($patterns as $pattern) {
            $base->whereRaw(
                "immutable_unaccent(lower(title || ' ' || coalesce(notes, ''))) ILIKE immutable_unaccent(lower(?)) ESCAPE '!'",
                [$pattern]
            );
        }

        // Compute counts for all, open, completed
        $countsQuery = clone $base;
        $countsRow = $countsQuery
            ->selectRaw('COUNT(*) as total_all')
            ->selectRaw('COUNT(CASE WHEN done = false THEN 1 END) as total_open')
            ->selectRaw('COUNT(CASE WHEN done = true THEN 1 END) as total_completed')
            ->first();

        $counts = [
            'all' => (int) ($countsRow->total_all ?? 0),
            'open' => (int) ($countsRow->total_open ?? 0),
            'completed' => (int) ($countsRow->total_completed ?? 0),
        ];

        // Apply status filter
        if ($status === 'open') {
            $base->where('done', false);
        } elseif ($status === 'completed') {
            $base->where('done', true);
        }

        // Build in_title expression (1 if ALL words match title, 0 otherwise)
        $titleConditions = [];
        $titleBindings = [];
        foreach ($patterns as $pattern) {
            $titleConditions[] = "immutable_unaccent(lower(title)) ILIKE immutable_unaccent(lower(?)) ESCAPE '!'";
            $titleBindings[] = $pattern;
        }
        $inTitleSql = '(CASE WHEN '.implode(' AND ', $titleConditions).' THEN 1 ELSE 0 END)';

        $base->select('tasks.*');
        $base->selectRaw("{$inTitleSql} AS in_title", $titleBindings);

        // Keyset pagination cursor
        $cursorData = $this->decodeCursor($cursor);
        if ($cursorData !== null) {
            [$cInTitle, $cDone, $cDueDate, $cId] = $cursorData;
            $base->where(function (Builder $q) use ($inTitleSql, $titleBindings, $cInTitle, $cDone, $cDueDate, $cId): void {
                $q->whereRaw("{$inTitleSql} < ?", [...$titleBindings, $cInTitle])
                    ->orWhere(function (Builder $q2) use ($inTitleSql, $titleBindings, $cInTitle, $cDone, $cDueDate, $cId): void {
                        $q2->whereRaw("{$inTitleSql} = ?", [...$titleBindings, $cInTitle])
                            ->where(function (Builder $q3) use ($cDone, $cDueDate, $cId): void {
                                $q3->where('done', '>', $cDone)
                                    ->orWhere(function (Builder $q4) use ($cDone, $cDueDate, $cId): void {
                                        $q4->where('done', '=', $cDone)
                                            ->where(function (Builder $q5) use ($cDueDate, $cId): void {
                                                // Ordering: due_date ASC NULLS LAST, id ASC
                                                if ($cDueDate === null) {
                                                    // Previous was null due_date, only null due_dates with id > cId
                                                    $q5->whereNull('due_date')->where('id', '>', $cId);
                                                } else {
                                                    // Previous had due_date
                                                    $q5->where(function (Builder $q6) use ($cDueDate, $cId): void {
                                                        $q6->where('due_date', '>', $cDueDate)
                                                            ->orWhereNull('due_date')
                                                            ->orWhere(function (Builder $q7) use ($cDueDate, $cId): void {
                                                                $q7->where('due_date', '=', $cDueDate)
                                                                    ->where('id', '>', $cId);
                                                            });
                                                    });
                                                }
                                            });
                                    });
                            });
                    });
            });
        }

        // Sorting:
        // 1. in_title DESC
        // 2. done ASC (open before completed)
        // 3. due_date ASC NULLS LAST
        // 4. id ASC
        $base->orderByRaw("{$inTitleSql} DESC", $titleBindings)
            ->orderBy('done', 'asc')
            ->orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC')
            ->orderBy('due_date', 'asc')
            ->orderBy('id', 'asc')
            ->limit(self::PAGE_SIZE + 1);

        $results = $base->get();

        $nextCursor = null;
        if ($results->count() > self::PAGE_SIZE) {
            $items = $results->slice(0, self::PAGE_SIZE);
            /** @var Task $lastItem */
            $lastItem = $items->last();
            $nextCursor = $this->encodeCursor($lastItem);
        } else {
            $items = $results;
        }

        return [
            'items' => array_values(TaskResource::collection($items)->resolve()),
            'counts' => $counts,
            'next_cursor' => $nextCursor,
        ];
    }

    /**
     * @return array{0: int, 1: int, 2: string|null, 3: string}|null
     */
    private function decodeCursor(?string $cursor): ?array
    {
        if (! is_string($cursor) || $cursor === '') {
            return null;
        }

        $decoded = base64_decode($cursor, true);
        if ($decoded === false) {
            return null;
        }

        try {
            $data = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($data) || count($data) !== 4) {
                return null;
            }

            return [
                (int) $data[0],
                (int) $data[1],
                is_string($data[2]) && $data[2] !== '' ? $data[2] : null,
                (string) $data[3],
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    private function encodeCursor(Task $task): string
    {
        $inTitle = (int) ($task->getAttribute('in_title') ?? 0);
        $done = $task->done ? 1 : 0;
        $dueDate = $task->due_date ? (string) $task->due_date : null;
        $id = (string) $task->id;

        return base64_encode((string) json_encode([$inTitle, $done, $dueDate, $id]));
    }
}
