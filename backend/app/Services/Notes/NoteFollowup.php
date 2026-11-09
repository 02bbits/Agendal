<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\PlanStatus;
use App\Exceptions\ApiError;
use App\Models\Note;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Support\Facades\DB;

/** RV-3: Keep it as task plans the whole text as one task and opens Check this first; Apply makes it. */
final class NoteFollowup
{
    public function __construct(private NoteEngine $engine, private NoteApplier $applier, private ClockInterface $clock) {}

    public function makeTask(Note $note): Note
    {
        return DB::transaction(function () use ($note): Note {
            $user = User::query()->whereKey($note->user_id)->lockForUpdate()->firstOrFail();
            $note = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();
            // A retry after a lost response shows the same review instead of planning it again.
            if ($note->status === PlanStatus::Confirm->value && ($note->plan['followup_task'] ?? false)) {
                return $note;
            }
            if ($note->status !== PlanStatus::Followup->value) {
                throw new ApiError('note.wrong_status', 'This note has already been handled.', 409);
            }
            $context = new NoteContext($this->clock->now(), (string) $user->timezone);
            $build = $this->engine->plainTask($note->text, $context);
            $note->forceFill([
                'name' => $build->name, 'status' => PlanStatus::Confirm->value, 'engine' => $build->engine->value,
                'processed_at' => $this->clock->now(),
                'plan' => [...$build->plan, 'changes' => $this->applier->preview($note, $build->plan), 'followup_task' => true],
                'plan_version' => $note->nextPlanVersion(),
            ])->save();

            return $note->refresh();
        }, 3);
    }
}
