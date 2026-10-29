<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;
use DateTimeZone;

final readonly class NoteContext
{
    /** @param array<string, string> $projects */
    public function __construct(
        public DateTimeImmutable $now,
        public string $timezone,
        public array $projects = [],
        public string $weekStart = 'monday',
    ) {}

    public function local(): DateTimeImmutable
    {
        return $this->now->setTimezone(new DateTimeZone($this->timezone));
    }
}
