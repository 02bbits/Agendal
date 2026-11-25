<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Models\Task;
use App\Support\Stamp;
use Illuminate\Support\Facades\DB;

/**
 * Completion and deletion as fields (ADR-004): the REST endpoints and `POST /sync/patches` both
 * come through here. A sync patch carries its `at` and only wins when it is later than the field's
 * stamp; a REST call (`at` null for delete/restore) is the server's own "now".
 */
final class TaskLifecycle
{
    public function __construct(
        private readonly TaskPatcher $patcher,
        private readonly TaskRecurrence $recurrence,
    ) {}

    /** @return array{task: Task, next: Task|null} */
    public function complete(Task $task, ?string $at): array
    {
        return DB::transaction(function () use ($task, $at): array {
            $this->lockSeries($task);
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $wasDone = $locked->done;
            $updated = $this->patcher->complete($locked, $at);
            $next = null;
            if ($updated->done) {
                // Reopened after later occurrences were done: the series goes on from the last done one,
                // so completing it again brings back the open occurrence its reopening withdrew
                $last = $updated;
                while (($following = $this->recurrence->following($last)) !== null && $following->done) {
                    $last = $following;
                }
                // The next occurrence is made once: `previous_occurrence_id` is unique (TK-E7, OFF-20)
                $next = $this->recurrence->next($last, restoreDeleted: ! $wasDone);
            }

            return ['task' => $updated, 'next' => $next?->trashed() ? null : $next];
        });
    }

    /**
     * Reopens a task. A repeating series keeps one open occurrence (#168): every open occurrence
     * after this one is withdrawn (the series goes back to this one, never to an occurrence the
     * user had undone), and an open one before it goes back to done. `next` is the withdrawn
     * occurrence that directly followed this one, as before; `withdrawn` and `closed` list every
     * change for the client.
     *
     * With `$merge` (unticked in a Completed list), a done occurrence goes back into its series when
     * an occurrence after it is done, or open and edited: it is removed (`merged`) and the open one
     * stays as it is, edits kept. Otherwise it is reopened as above, so a tick by mistake rolls back
     * to its own date.
     *
     * @return array{task: Task, next: Task|null, withdrawn: list<Task>, closed: list<Task>, merged: bool}
     */
    public function reopen(Task $task, ?string $at, bool $merge = false): array
    {
        return DB::transaction(function () use ($task, $at, $merge): array {
            $this->lockSeries($task);
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($merge && $locked->done && $this->goesBackIntoSeries($locked)) {
                $this->delete($locked, $at);

                return ['task' => $locked, 'next' => null, 'withdrawn' => [], 'closed' => [], 'merged' => true];
            }
            $wasDone = $locked->done;
            $updated = $this->patcher->reopen($locked, $at);
            $withdrawn = [];
            $closed = [];
            if (! $updated->done) {
                $after = false;
                for ($node = $this->recurrence->first($updated); $node !== null; $node = $this->recurrence->following($node)) {
                    if ($node->id === $updated->id) {
                        $after = true;
                    } elseif ($after && ! $node->done) {
                        $withdrawn[] = $this->withdraw($node, $at);
                    } elseif (! $after && ! $node->done && ! $node->trashed()) {
                        $completed = $this->patcher->complete($node, $at);
                        if ($completed->done) {
                            $closed[] = $completed;
                        }
                    }
                }
                if ($wasDone) {
                    OpenTaskLimit::ensureRoom(additional: 0);
                }
            }
            $first = $withdrawn[0] ?? null;

            return [
                'task' => $updated,
                'next' => $first?->previous_occurrence_id === $updated->id ? $first : null,
                'withdrawn' => $withdrawn,
                'closed' => $closed,
                'merged' => false,
            ];
        });
    }

    /**
     * Unticked in a Completed list, this done occurrence goes back into its series rather than
     * rolling it back: one after it is done, or open and edited (rolling back would lose the edits),
     * and the series still has an open occurrence to go back into.
     */
    private function goesBackIntoSeries(Task $task): bool
    {
        $following = $this->recurrence->following($task);
        if ($following === null) {
            return false;
        }
        $keepFollowing = $following->done || (! $following->trashed() && $this->wasEdited($following));

        return $keepFollowing && $this->seriesHasOtherOpen($task);
    }

    /** Changed since a completion made it: its fields no longer all carry the one stamp it was made with. */
    private function wasEdited(Task $task): bool
    {
        $stamps = array_intersect_key($task->field_updated_at ?? [], array_flip(Task::PATCHABLE));

        return count(array_unique($stamps)) > 1;
    }

    /** Another occurrence of the series is open (not done, not deleted). */
    private function seriesHasOtherOpen(Task $task): bool
    {
        for ($node = $this->recurrence->first($task); $node !== null; $node = $this->recurrence->following($node)) {
            if ($node->id !== $task->id && ! $node->done && ! $node->trashed()) {
                return true;
            }
        }

        return false;
    }

    /** Soft-deletes an open occurrence (already gone stays gone). */
    private function withdraw(Task $task, ?string $at): Task
    {
        if (! $task->trashed()) {
            $fields = $task->field_updated_at;
            $fields['deleted'] = Stamp::of($this->patcher->resolveEffectiveAt($at));
            $task->field_updated_at = $fields;
            $task->delete();
        }

        return $task;
    }

    /** Completing and reopening in one series take turns, so fast taps can't leave two open. */
    private function lockSeries(Task $task): void
    {
        Task::withTrashed()->whereKey($this->recurrence->first($task)->id)->lockForUpdate()->first();
    }

    /** Soft delete. False when a later `deleted` stamp already won. */
    public function delete(Task $task, ?string $at = null): bool
    {
        if ($task->trashed() || ! $this->wins($task, $at)) {
            return false;
        }
        $this->stamp($task, $at);
        $task->save();
        $task->delete();

        return true;
    }

    /**
     * Delete with repeating task scope ('one' or 'future').
     * When scope is 'one' on an uncompleted repeating task, creates the next occurrence.
     *
     * @return array{deleted: bool, next: Task|null}
     */
    public function deleteScope(Task $task, ?string $scope = null, ?string $at = null): array
    {
        return DB::transaction(function () use ($task, $scope, $at): array {
            $locked = Task::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            $next = null;
            if ($scope === 'one' && ! $locked->done) {
                $next = $this->recurrence->next($locked, restoreDeleted: true);
                if ($next?->trashed()) {
                    $next = null;
                }
            }

            if ($scope === 'future') {
                $deleted = $this->deleteFutureChain($locked, $at);

                return ['deleted' => $deleted, 'next' => null];
            }

            $deleted = $this->delete($locked, $at);

            return ['deleted' => $deleted, 'next' => $next];
        });
    }

    /** Soft-deletes $root and any following occurrences linked via `previous_occurrence_id`. */
    private function deleteFutureChain(Task $root, ?string $at): bool
    {
        $deleted = $this->delete($root, $at);
        $visited = [$root->id => true];
        $cursor = $root;

        while (($following = $this->recurrence->following($cursor)) !== null) {
            if (isset($visited[$following->id])) {
                break;
            }
            $visited[$following->id] = true;
            $lockedFollowing = Task::withTrashed()->whereKey($following->id)->lockForUpdate()->first();
            if ($lockedFollowing === null) {
                break;
            }
            if (! $lockedFollowing->trashed()) {
                $this->delete($lockedFollowing, $at);
            }
            $cursor = $lockedFollowing;
        }

        return $deleted;
    }

    /** Undoes a delete. False when a later `deleted` stamp already won. */
    public function restore(Task $task, ?string $at = null): bool
    {
        return DB::transaction(function () use ($task, $at): bool {
            $locked = Task::withTrashed()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            if (! $locked->trashed() || ! $this->wins($locked, $at)) {
                return false;
            }
            if (! $locked->done) {
                $child = Task::withTrashed()
                    ->where('previous_occurrence_id', $locked->id)
                    ->lockForUpdate()
                    ->first();
                if ($child !== null && ! $child->done && ! $child->trashed()) {
                    $fields = $child->field_updated_at ?? [];
                    $fields['deleted'] = Stamp::of($this->patcher->resolveEffectiveAt($at));
                    $child->field_updated_at = $fields;
                    $child->save();
                    $child->delete();
                }
                OpenTaskLimit::ensureRoom();
            }
            $this->stamp($locked, $at);
            $locked->save();
            $locked->restore();

            return true;
        });
    }

    private function wins(Task $task, ?string $at): bool
    {
        return $at === null
            || $this->patcher->isLaterThan($this->patcher->resolveEffectiveAt($at), $task->field_updated_at['deleted'] ?? null);
    }

    private function stamp(Task $task, ?string $at): void
    {
        $fields = $task->field_updated_at ?? [];
        $fields['deleted'] = Stamp::of($this->patcher->resolveEffectiveAt($at));
        $task->field_updated_at = $fields;
    }
}
