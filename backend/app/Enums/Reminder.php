<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed by the tasks_reminder check constraint. */
enum Reminder: string
{
    case None = 'none';
    case FiveMinutes = '5m';
    case FifteenMinutes = '15m';
    case ThirtyMinutes = '30m';
    case OneHour = '1h';
    case OneDay = '1d';
}
