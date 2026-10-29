<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property string $id
 * @property string $name
 * @property string $colour
 *
 * @mixin Project
 */
class ProjectResource extends JsonResource
{
    /**
     * @var string|null
     */
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array{id: string, name: string, colour: string, open: int, done: int}
     */
    public function toArray(Request $request): array
    {
        /** @var Project $project */
        $project = $this->resource;

        return [
            'id' => (string) $project->id,
            'name' => (string) $project->name,
            'colour' => (string) $project->colour,
            'open' => (int) ($project->getAttribute('open') ?? 0),
            'done' => (int) ($project->getAttribute('done') ?? 0),
        ];
    }
}
