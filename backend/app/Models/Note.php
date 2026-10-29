<?php

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use App\Services\Clock\ClockInterface;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property array<string, mixed>|null $plan
 * @property list<array<string, mixed>> $applied
 * @property CarbonImmutable $written_at
 * @property CarbonImmutable $processed_at
 */
class Note extends Model
{
    use HasUuids, OwnedByUser;

    const UPDATED_AT = null;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['plan' => 'array', 'applied' => 'array', 'undo_log' => 'array', 'written_at' => 'immutable_datetime', 'processed_at' => 'immutable_datetime'];
    }

    public function freshTimestamp(): Carbon
    {
        return Carbon::instance(app(ClockInterface::class)->now());
    }
}
