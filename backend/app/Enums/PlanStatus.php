<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * A note's status; a subset of the notes_status check constraint. The engine gives a plan done, confirm or followup;
 * a note is pending after Undo all (RV-2).
 */
enum PlanStatus: string
{
    case Done = 'done';
    case Confirm = 'confirm';
    case Followup = 'followup';
    case Pending = 'pending';

    /**
     * What the Notes tab shows as Pending, needing a look (RV-4): every status but Accepted.
     *
     * @return list<string>
     */
    public static function needsLook(): array
    {
        return [self::Confirm->value, self::Followup->value, self::Pending->value];
    }
}
