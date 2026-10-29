<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed by the users_week_start check constraint (AP-5). */
enum WeekStart: string
{
    case Monday = 'mon';
    case Sunday = 'sun';

    /** Day of week as PHP's "w" format: 0 = Sunday … 6 = Saturday. */
    public function firstDay(): int
    {
        return $this === self::Sunday ? 0 : 1;
    }

    public function lastDay(): int
    {
        return ($this->firstDay() + 6) % 7;
    }
}
