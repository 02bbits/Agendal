<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\PlanStatus;
use App\Enums\SkipReason;

/** NU §2.6: the status of a note's plan, checked in order. Skipped items never count as changes. */
final class PlanStatusResolver
{
    /** @param list<SkipReason> $skipReasons */
    public function resolve(int $changes, bool $hasDelete, bool $hasTie, array $skipReasons): PlanStatus
    {
        if ($hasDelete || $hasTie || $changes > (int) config('notes.changes_before_confirm')) {
            return PlanStatus::Confirm;
        }
        if ($changes > 0) {
            return PlanStatus::Done;
        }

        // With no changes, only an item that was nothing actionable asks the follow-up (BR-02).
        // Commands that found their task done already or no task at all still show the result.
        $onlyUnmatchedCommands = $skipReasons !== [] && ! in_array(SkipReason::Skip, $skipReasons, true);

        return $onlyUnmatchedCommands ? PlanStatus::Done : PlanStatus::Followup;
    }
}
