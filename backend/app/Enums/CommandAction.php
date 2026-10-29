<?php

declare(strict_types=1);

namespace App\Enums;

/** What a command item does to an existing task (NU-3). */
enum CommandAction: string
{
    case Complete = 'complete';
    case Reschedule = 'reschedule';
    case Delete = 'delete';
}
