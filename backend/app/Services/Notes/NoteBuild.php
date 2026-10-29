<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\NoteEngineKind;
use App\Enums\PlanStatus;

/**
 * A note's validated plan and what the result shows about it.
 *
 * @phpstan-import-type ValidatedPlan from PlanValidator
 */
final readonly class NoteBuild
{
    /**
     * @param  ValidatedPlan  $plan
     * @param  array<string, string>  $lowConfidence  item ref => item text, for the LLM fallback (ADR-008)
     */
    public function __construct(
        public array $plan,
        public PlanStatus $status,
        public string $name,
        public NoteEngineKind $engine,
        public array $lowConfidence,
        public ?string $promptVersion = null,
    ) {}

    /** The same plan, marked as the rules result kept after the model was not used or failed. */
    public function asFallback(): self
    {
        return new self($this->plan, $this->status, $this->name, NoteEngineKind::RulesFallback, $this->lowConfidence, $this->promptVersion);
    }
}
