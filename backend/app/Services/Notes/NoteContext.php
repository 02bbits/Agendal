<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\WeekStart;
use DateTimeImmutable;
use DateTimeZone;

final readonly class NoteContext
{
    /** @param array<string, string> $projects project id => name */
    public function __construct(
        public DateTimeImmutable $now,
        public string $timezone,
        public array $projects = [],
        public WeekStart $weekStart = WeekStart::Monday,
    ) {}

    public function local(): DateTimeImmutable
    {
        return $this->now->setTimezone(new DateTimeZone($this->timezone));
    }

    public function today(): DateTimeImmutable
    {
        return $this->local()->setTime(0, 0);
    }

    /** "H:i" in the note's zone, comparable as a string with parsed times. */
    public function clock(): string
    {
        return $this->local()->format('H:i');
    }
}
