<?php

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use App\Services\Clock\ClockInterface;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property array<string, mixed>|null $plan
 * @property list<array<string, mixed>> $applied
 * @property array{redo_until: string, changes: list<array{task_id: string, before: array<string, mixed>, after: array<string, mixed>}>}|null $undo_log
 * @property CarbonImmutable $written_at
 * @property CarbonImmutable $processed_at
 * @property ?CarbonImmutable $edited_at
 */
class Note extends Model
{
    use HasUuids, OwnedByUser, SoftDeletes;

    const UPDATED_AT = null;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['plan' => 'array', 'applied' => 'array', 'undo_log' => 'array', 'written_at' => 'immutable_datetime', 'processed_at' => 'immutable_datetime', 'edited_at' => 'immutable_datetime', 'deleted_at' => 'immutable_datetime'];
    }

    public function freshTimestamp(): Carbon
    {
        return Carbon::instance(app(ClockInterface::class)->now());
    }
}
