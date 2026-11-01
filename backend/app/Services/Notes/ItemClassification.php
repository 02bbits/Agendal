<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\CommandAction;
use App\Enums\ItemKind;

final readonly class ItemClassification
{
    private function __construct(
        public ItemKind $kind,
        public ?CommandAction $action = null,
    ) {}

    public static function task(): self
    {
        return new self(ItemKind::Task);
    }

    public static function skip(): self
    {
        return new self(ItemKind::Skip);
    }

    public static function command(CommandAction $action): self
    {
        return new self(ItemKind::Command, $action);
    }
}
