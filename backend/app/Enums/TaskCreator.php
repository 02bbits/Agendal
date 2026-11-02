<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed by the tasks_created_by check constraint (NU-7). */
enum TaskCreator: string
{
    case User = 'user';
    case Assistant = 'assistant';
}
