<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;

/**
 * The user's tasks that share a meaningful word with a command, by trigram relevance (NU §2.4).
 *
 * @phpstan-import-type TaskRow from CommandMatcher
 */
final class TaskCandidates
{
    /**
     * @param  list<string>  $words
     * @return list<TaskRow>
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
            ->map(fn (Task $task): array => $this->row($task))->all());
    }

    /** @return TaskRow */
    private function row(Task $task): array
    {
        $attributes = $task->getAttributes();
        $hourMinute = fn (mixed $time): ?string => $time === null ? null : substr((string) $time, 0, 5);

        return [
            'id' => (string) $task->id,
            'title' => (string) $task->title,
            'user_id' => (int) $task->user_id,
            'due_date' => $attributes['due_date'] === null ? null : substr((string) $attributes['due_date'], 0, 10),
            'start_time' => $hourMinute($attributes['start_time']),
            'end_time' => $hourMinute($attributes['end_time']),
            'done' => (bool) $attributes['done'],
            'deleted_at' => $attributes['deleted_at'] === null ? null : (string) $attributes['deleted_at'],
        ];
    }
}
