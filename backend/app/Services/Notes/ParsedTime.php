<?php

declare(strict_types=1);

namespace App\Services\Notes;

/** A start/end time read from an item and where its words are, so the title can drop exactly those. */
final readonly class ParsedTime
{
    /**
     * @param  ?string  $date  set when the time fixes its own day ("in 2 hours" late in the evening)
     * @param  list<array{0: int, 1: int}>  $spans  byte offset and length of each word group read
     */
    public function __construct(
        public ?string $start = null,
        public ?string $end = null,
        public array $spans = [],
        public bool $unreadable = false,
        public ?string $date = null,
    ) {}
}
