<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Task;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Task
 */
class TaskResource extends JsonResource
{
    /**
     * The "data" wrapper that should be applied.
     *
     * @var string|null
     */
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'due_date' => $this->due_date ? substr((string) $this->due_date, 0, 10) : null,
            'start_time' => $this->start_time !== null ? substr((string) $this->start_time, 0, 5) : null,
            'end_time' => $this->end_time !== null ? substr((string) $this->end_time, 0, 5) : null,
            'priority' => $this->priority ?: null,
            'project_id' => $this->project_id,
            'repeat' => $this->repeat ?? 'never',
            'reminder' => $this->reminder ?? 'none',
            'notes' => $this->notes,
            'done' => (bool) $this->done,
            'done_at' => $this->formatIso($this->done_at),
            'created_by' => $this->created_by,
            'source_note_id' => $this->source_note_id,
            'created_at' => $this->formatIso($this->created_at),
            'updated_at' => $this->formatIso($this->updated_at),
        ];
    }

    private function formatIso(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value->toIso8601String();
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        return (new \DateTimeImmutable((string) $value))->format(DateTimeInterface::ATOM);
    }
}
