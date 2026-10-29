<?php

declare(strict_types=1);

namespace App\Services\Notes;

/** A due date read from an item and the phrase it came from. */
final readonly class ParsedDate
{
    public function __construct(
        public ?string $date = null,
        public string $phrase = '',
        public bool $unreadable = false,
    ) {}
}
