<?php

declare(strict_types=1);

namespace App\Services\Notes;

/** One planned change to an existing task, as the note plan's update or delete entry (NU §7). */
final readonly class TaskChange
{
    /** @param array{done?: true, due_date?: string, start_time?: string, end_time?: ?string} $fields only the fields that change */
    public function __construct(
        public string $taskId,
        public string $label,
        public bool $delete = false,
        public array $fields = [],
    ) {}
}
