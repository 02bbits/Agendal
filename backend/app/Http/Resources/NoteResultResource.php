<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Note */
class NoteResultResource extends JsonResource
{
    public static $wrap = null;

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $plan = $this->plan ?? [];

        return [
            'note' => [
                'id' => $this->id, 'client_id' => $this->client_id, 'status' => $this->status, 'name' => $this->name,
                'text' => $this->text, 'source_file_name' => $this->source_file_name,
                'written_at' => $this->written_at->format(DATE_ATOM), 'processed_at' => $this->processed_at->format(DATE_ATOM), 'engine' => $this->engine,
            ],
            'changes' => $plan['changes'] ?? [],
            'plan' => $this->status === 'confirm' ? array_intersect_key($plan, array_flip(['create', 'update', 'delete'])) : null,
            'skipped' => $plan['skipped'] ?? [], 'ambiguous' => $plan['ambiguous'] ?? [],
        ];
    }
}
