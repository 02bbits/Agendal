<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Exceptions\ApiError;
use App\Models\Note;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Support\Facades\DB;

/** RV-3: resolve a follow-up by keeping its text as one task, with the normal applier and Undo log. */
final class NoteFollowup
{
    public function __construct(private NoteEngine $engine, private NoteApplier $applier, private ClockInterface $clock) {}

    public function makeTask(Note $note): Note
    {
        return DB::transaction(function () use ($note): Note {
            $user = User::query()->whereKey($note->user_id)->lockForUpdate()->firstOrFail();
            $note = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();
            // A retry after a lost response opens the same task instead of creating another one.
            if ($note->status === 'done' && ($note->plan['followup_task'] ?? false)) {
                return $note;
            }
            if ($note->status !== 'followup') {
                throw new ApiError('note.wrong_status', 'This note has already been handled.', 409);
            }
            $context = new NoteContext($this->clock->now(), (string) $user->timezone);
            $build = $this->engine->plainTask($note->text, $context);
            $applied = $this->applier->apply($note, $build->plan);
            $note->forceFill([
                'name' => $build->name, 'status' => 'done', 'engine' => $build->engine->value,
                'processed_at' => $this->clock->now(), 'applied' => $applied['applied'],
                'plan' => [...$build->plan, 'changes' => $applied['changes'], 'skipped' => $applied['skipped'], 'followup_task' => true],
            ])->save();

            return $note->refresh();
        }, 3);
    }
}
