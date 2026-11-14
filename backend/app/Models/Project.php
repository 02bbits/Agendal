<?php

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property array<string, string> $field_updated_at
 */
class Project extends Model
{
    use HasUuids, OwnedByUser;

    /** Fields a sync patch may write (PJ §8). */
    public const PATCHABLE = ['name', 'colour', 'deleted'];

    protected function casts(): array
    {
        return ['field_updated_at' => 'array', 'deleted_at' => 'immutable_datetime'];
    }
}
