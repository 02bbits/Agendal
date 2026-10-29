<?php

declare(strict_types=1);

namespace App\Services\Notes;

/** A start/end time read from an item and the phrases it came from. */
final readonly class ParsedTime
{
    private const HALF_DAY_HOURS = 12;

    /** @param list<string> $phrases */
    public function __construct(
        public ?string $start = null,
        public ?string $end = null,
        public array $phrases = [],
        public bool $unreadable = false,
        public bool $couldBeEvening = false,
    ) {}

    /** The same time twelve hours later ("at 7" → 19:00). */
    public function inTheEvening(): self
    {
        $start = $this->start === null ? null : sprintf('%02d:%s', (int) substr($this->start, 0, 2) + self::HALF_DAY_HOURS, substr($this->start, 3));

        return new self($start, $this->end, $this->phrases, $this->unreadable);
    }
}
