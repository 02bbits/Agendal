<?php

declare(strict_types=1);

namespace App\Enums;

/** Values allowed by the tasks_repeat check constraint. */
enum Repeat: string
{
    case Never = 'never';
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case Yearly = 'yearly';
}
