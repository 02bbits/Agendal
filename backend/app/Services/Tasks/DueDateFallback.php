<?php

declare(strict_types=1);

namespace App\Services\Tasks;

class DueDateFallback
{
    public static function needed(?string $dueDate, ?string $dueTime, ?string $startDate, string $repeat): bool
    {
        return empty($dueDate) && ($dueTime !== null || ($repeat !== 'never' && empty($startDate)));
    }

    public static function startDate(?string $startDate, ?string $startTime, ?string $dueDate, string $today): ?string
    {
        return ! empty($startDate) ? $startDate : ($startTime !== null ? ($dueDate ?: $today) : null);
    }
}
