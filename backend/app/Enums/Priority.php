<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed by the tasks_priority check constraint. */
enum Priority: string
{
    case Low = 'low';
    case Medium = 'medium';
    case High = 'high';
}
