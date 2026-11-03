<?php

declare(strict_types=1);

namespace App\Services\Tasks;

use App\Exceptions\ApiError;
use App\Models\Task;

class OpenTaskLimit
{
    public static function ensureRoom(int $additional = 1): void
    {
        $openCount = Task::where('done', false)->count();
        if ($openCount + $additional > Task::OPEN_LIMIT) {
            throw new ApiError('task.limit', "You've reached 5,000 open tasks. Complete or delete some to add more.", 422);
        }
    }
}
