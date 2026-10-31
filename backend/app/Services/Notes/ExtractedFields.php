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

    /** These fields with the date and times of $at, as a reschedule with no matching task becomes a new task. */
    public function withWhen(self $at): self
    {
        return new self($this->title, $this->notes, $at->dueDate, $at->startTime, $at->endTime, $this->priority, $this->projectId, $this->repeat, $this->reminder, $this->lowConfidence || $at->lowConfidence);
    }
}
