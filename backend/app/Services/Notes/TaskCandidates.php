<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;

/** The user's tasks that share a meaningful word with a command, by trigram relevance (NU §2.4). */
final class TaskCandidates
{
    /**
     * @param  list<string>  $words
     * @return list<array<string, mixed>>
     */
    public function find(int $userId, array $words, bool $done = false): array
    {
        if ($words === []) {
            return [];
        }
        $query = Task::query()->where('user_id', $userId)->where('done', $done)->whereNull('deleted_at');
        $query->where(function (Builder $query) use ($words): void {
            foreach ($words as $word) {
                $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $word);
                $query->orWhereRaw("(immutable_unaccent(title) % immutable_unaccent(?) OR immutable_unaccent(title) ILIKE immutable_unaccent(?) ESCAPE '!')", [$word, '%'.$escaped.'%']);
            }
        });
        $rank = implode(', ', array_fill(0, count($words), 'similarity(immutable_unaccent(title), immutable_unaccent(?))'));

        return array_values($query->orderByRaw('greatest('.$rank.') DESC', $words)->orderBy('id')->limit((int) config('notes.match_candidates'))->get()
            ->map(function (Task $task): array {
                $row = $task->getAttributes();
                foreach (['start_time', 'end_time'] as $key) {
                    $row[$key] = isset($row[$key]) ? substr($row[$key], 0, 5) : null;
                }
                $row['done'] = (bool) $row['done'];

                return $row;
            })->all());
    }
}
