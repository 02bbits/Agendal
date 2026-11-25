<?php

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property array<string, string> $field_updated_at
 */
class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory, HasUuids, OwnedByUser;

    /** Fields a sync patch may write (PJ §8). */
    public const PATCHABLE = ['name', 'colour', 'deleted'];

    protected function casts(): array
    {
        return ['field_updated_at' => 'array', 'deleted_at' => 'immutable_datetime'];
    }
}
