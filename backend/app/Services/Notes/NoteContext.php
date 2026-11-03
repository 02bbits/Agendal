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
        public bool $twelveHour = false,
    ) {}

    public function local(): DateTimeImmutable
    {
        return $this->now->setTimezone(new DateTimeZone($this->timezone));
    }

    public function today(): DateTimeImmutable
    {
        return $this->local()->setTime(0, 0);
    }

    /** What every reading of a text depends on, so a result read under this context can be kept for it. */
    public function key(): string
    {
        return $this->now->format('U').'|'.$this->timezone.'|'.$this->weekStart->value.'|'.(int) $this->twelveHour.'|'.json_encode($this->projects);
    }

    /** "H:i" in the note's zone, comparable as a string with parsed times. */
    public function clock(): string
    {
        return $this->local()->format('H:i');
    }

    /** A change label's date and time (UX-32): "Fri 30 Oct 09:00", "Fri 30 Oct · 9:00 am" with a " · " glue; empty for neither. */
    public function scheduled(?string $date, ?string $start, string $glue = ' '): string
    {
        $day = $date === null ? null : (new DateTimeImmutable($date))->format(__('notes.label.date_format'));
        $time = $start === null || ! $this->twelveHour ? $start : (new DateTimeImmutable($start))->format('g:i a');

        return implode($glue, array_filter([$day, $time]));
    }
}
