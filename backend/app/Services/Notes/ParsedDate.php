<?php

declare(strict_types=1);

namespace App\Services\Notes;

/** A due date read from an item and where its words are, so the title can drop exactly those. */
final readonly class ParsedDate
{
    /** @param list<array{0: int, 1: int}> $spans byte offset and length of each word group read */
    public function __construct(
        public ?string $date = null,
        public array $spans = [],
        public bool $unreadable = false,
    ) {}
}
