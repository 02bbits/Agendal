<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\PlanStatus;
use App\Exceptions\ApiError;
use App\Models\Note;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Apply changes and Edit note on Check this first (NU-5, WF-02). Each locks the note, so a double tap applies once.
 *
 * @phpstan-import-type ValidatedPlan from PlanValidator
 */
final class NoteConfirm
{
    public function __construct(private NoteApplier $applier) {}

    /**
     * Applies a `confirm` plan, re-validated against the tasks as they are now (NU-E38), with the user's edits.
     *
     * @param  array<string, array<string, mixed>>  $edits
     */
    public function apply(Note $note, array $edits = []): Note
    {
        return DB::transaction(function () use ($note, $edits): Note {
            // The user row first, as POST /notes locks it, so a note and an apply can't deadlock.
            User::query()->whereKey($note->user_id)->lockForUpdate()->firstOrFail();
            $note = $this->locked($note);
            /** @var ValidatedPlan $plan */
            $plan = $note->plan;
            $applied = $this->applier->apply($note, $plan, $edits);
            $note->forceFill([
                'status' => PlanStatus::Done->value, 'applied' => $applied['applied'],
                'plan' => [...$plan, 'changes' => $applied['changes'], 'skipped' => $applied['skipped']],
            ])->save();

            return $note->refresh();
        });
    }

    /** Edit note on Check this first: nothing is applied and the note is kept (WF-02). */
    public function cancel(Note $note): Note
    {
        return DB::transaction(function () use ($note): Note {
            $note = $this->locked($note);
            $note->forceFill(['status' => 'kept'])->save();

            return $note->refresh();
        });
    }

    private function locked(Note $note): Note
    {
        $note = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();
        if ($note->status !== PlanStatus::Confirm->value) {
            throw new ApiError('note.wrong_status', 'This note has already been handled.', 409);
        }

        return $note;
    }
}
