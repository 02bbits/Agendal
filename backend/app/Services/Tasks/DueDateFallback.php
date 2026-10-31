<?php

declare(strict_types=1);

namespace App\Services\Tasks;

class DueDateFallback
{
    public static function needed(?string $dueDate, ?string $startTime, string $repeat): bool
    {
        return empty($dueDate) && ($startTime !== null || $repeat !== 'never');
    }
}
