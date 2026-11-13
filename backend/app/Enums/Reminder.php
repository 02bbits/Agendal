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
    // #154: more offsets for tasks set by hand. Notes still only use the ones above.
    case AtStart = '0m';
    case TenMinutes = '10m';
    case TwoHours = '2h';
    case TwoDays = '2d';
    case OneWeek = '1w';

    /** Minutes before the start (or due) moment. */
    public function minutes(): int
    {
        return match ($this) {
            self::None, self::AtStart => 0,
            self::FiveMinutes => 5,
            self::TenMinutes => 10,
            self::FifteenMinutes => 15,
            self::ThirtyMinutes => 30,
            self::OneHour => 60,
            self::TwoHours => 120,
            self::OneDay => 1440,
            self::TwoDays => 2880,
            self::OneWeek => 10080,
        };
    }
}
