<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\Priority;
use App\Enums\Reminder;
use App\Enums\Repeat;

/** Fields read from one task item (NU-2). Empty fields stay null. */
final readonly class ExtractedFields
{
    public function __construct(
        public string $title,
        public ?string $notes,
        public ?string $dueDate,
        public ?string $startTime,
        public ?string $endTime,
        public Priority $priority,
        public ?string $projectId,
        public Repeat $repeat,
        public Reminder $reminder,
        public bool $lowConfidence,
    ) {}
}
