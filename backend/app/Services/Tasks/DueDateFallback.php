<?php

declare(strict_types=1);

namespace App\Services\Tasks;

class DueDateFallback
{
    /** A repeat with neither date starts from today (TK §8). */
    public static function needed(?string $dueDate, ?string $startDate, string $repeat): bool
    {
        return empty($dueDate) && empty($startDate) && $repeat !== 'never';
    }

    /**
     * A time needs its day (TK §8): start_time needs start_date, due_time needs due_date.
     *
     * @return array<string, list<string>>
     */
    public static function timeErrors(?string $startDate, ?string $startTime, ?string $dueDate, ?string $dueTime): array
    {
        $errors = [];
        if ($startTime !== null && empty($startDate)) {
            $errors['start_date'] = ['Add a start date to set a start time.'];
        }
        if ($dueTime !== null && empty($dueDate)) {
            $errors['due_date'] = ['Add a due date to set a due time.'];
        }

        return $errors;
    }
}
