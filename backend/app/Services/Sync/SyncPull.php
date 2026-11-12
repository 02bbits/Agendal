<?php

declare(strict_types=1);

namespace App\Services\Sync;

use App\Http\Resources\ProjectResource;
use App\Http\Resources\TaskResource;
use App\Models\Note;
use App\Models\Project;
use App\Models\Task;
use App\Services\Clock\ClockInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * `GET /sync` (ADR-005): rows changed after the cursor, tombstones included, oldest change first.
 * `full` is the first download or the resync after `410`: only what the device keeps (AP §2.2),
 * no tombstones.
 *
 * ponytail: `change_seq` is taken at write time, so a row whose transaction commits after a later
 * one's can sit below a cursor already handed out. Fine at this scale; hold the cursor back to
 * `pg_snapshot_xmin` if a skipped change ever shows up.
 */
final class SyncPull
{
    public const KEEP_COMPLETED_DAYS = 90;

    public const KEEP_NOTES = 100;

    public function __construct(private readonly ClockInterface $clock) {}

    /** The cursor is older than purged tombstones: the device must download everything again. */
    public static function tooOld(int $cursor): bool
    {
        return $cursor > 0 && $cursor < (int) DB::table('sync_horizon')->value('purged_seq');
    }

    /** @return array{changes: array<string, list<array<string, mixed>>>, next_cursor: int, has_more: bool} */
    public function pull(int $cursor, int $limit, bool $full): array
    {
        $tasks = Task::withTrashed();
        $projects = Project::query();
        $notes = Note::withTrashed();
        if ($full) {
            $since = $this->clock->now()->modify('-'.self::KEEP_COMPLETED_DAYS.' days');
            $tasks = Task::query()->where(fn (Builder $q) => $q->where('done', false)->orWhere('done_at', '>=', $since));
            $projects->whereNull('deleted_at');
            $notes = Note::query()->whereIn('id', Note::query()->orderByDesc('written_at')->limit(self::KEEP_NOTES)->select('id'));
        }

        $rows = collect([
            ...$this->after($tasks, $cursor, $limit)->map(fn (Task $t) => ['tasks', $t]),
            ...$this->after($projects, $cursor, $limit)->map(fn (Project $p) => ['projects', $p]),
            ...$this->after($notes, $cursor, $limit)->map(fn (Note $n) => ['notes', $n]),
        ])->sortBy(fn (array $row) => $row[1]->getAttribute('change_seq'))->values();

        $page = $rows->take($limit);
        $changes = ['tasks' => [], 'projects' => [], 'notes' => []];
        foreach ($page as [$kind, $row]) {
            $changes[$kind][] = [...$this->shape($row), 'deleted_at' => $row->getAttribute('deleted_at')?->format(DATE_ATOM)];
        }
        $last = $page->last();

        return [
            'changes' => $changes,
            'next_cursor' => $last === null ? $cursor : (int) $last[1]->getAttribute('change_seq'),
            'has_more' => $rows->count() > $limit,
        ];
    }

    /**
     * @template T of Model
     *
     * @param  Builder<T>  $query
     * @return Collection<int, T>
     */
    private function after(Builder $query, int $cursor, int $limit)
    {
        // One extra row per table tells whether more remain
        return $query->where('change_seq', '>', $cursor)->orderBy('change_seq')->limit($limit + 1)->get()->toBase();
    }

    /** @return array<string, mixed> */
    private function shape(Model $row): array
    {
        return match (true) {
            $row instanceof Task => (new TaskResource($row))->resolve(),
            $row instanceof Note => $row->listRow(),
            default => array_diff_key((new ProjectResource($row))->resolve(), ['open' => 0, 'done' => 0]),
        };
    }
}
