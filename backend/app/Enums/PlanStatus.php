<?php

declare(strict_types=1);

namespace App\Enums;

/** The statuses the note engine can give a plan; a subset of the notes_status check constraint. */
enum PlanStatus: string
{
    case Done = 'done';
    case Confirm = 'confirm';
    case Followup = 'followup';
}
