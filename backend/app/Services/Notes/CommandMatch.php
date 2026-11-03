<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\SkipReason;

/** What a command item turned into: a change, a new task (reschedule with no match), or a skip. */
final readonly class CommandMatch
{
    /** @param list<string> $tiedTaskIds up to the tie limit, soonest due first (NU-E11) */
    private function __construct(
        public ?TaskChange $change = null,
        public array $tiedTaskIds = [],
        public ?ExtractedFields $newTask = null,
        public ?SkipReason $skip = null,
    ) {}

    /** @param list<string> $tiedTaskIds */
    public static function change(TaskChange $change, array $tiedTaskIds): self
    {
        return new self(change: $change, tiedTaskIds: $tiedTaskIds);
    }

    public static function newTask(ExtractedFields $fields): self
    {
        return new self(newTask: $fields);
    }

    public static function skip(SkipReason $reason): self
    {
        return new self(skip: $reason);
    }

    public function isTie(): bool
    {
        return count($this->tiedTaskIds) > 1;
    }
}
