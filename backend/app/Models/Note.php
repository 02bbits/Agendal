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
 * @property int $plan_version
 */
class Note extends Model
{
    use HasUuids, OwnedByUser, SoftDeletes;

    const UPDATED_AT = null;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['plan' => 'array', 'applied' => 'array', 'undo_log' => 'array', 'written_at' => 'immutable_datetime', 'processed_at' => 'immutable_datetime', 'edited_at' => 'immutable_datetime', 'deleted_at' => 'immutable_datetime', 'plan_version' => 'integer'];
    }

    /** The version a plan made now takes: Apply names the plan the user reviewed by it (RV §7). */
    public function nextPlanVersion(): int
    {
        return $this->exists ? $this->plan_version + 1 : 1;
    }

    /**
     * The note as the Notes list shows it (`GET /notes` items, `GET /sync` notes).
     *
     * @return array<string, mixed>
     */
    public function listRow(): array
    {
        $kinds = array_count_values(array_column($this->plan['changes'] ?? [], 'kind'));

        return ['id' => $this->id, 'status' => $this->status, 'name' => $this->name, 'excerpt' => mb_substr($this->text, 0, 140), 'written_at' => $this->written_at->format(DATE_ATOM), 'edited_at' => $this->edited_at?->format(DATE_ATOM), 'source_file_name' => $this->source_file_name, 'counts' => ['created' => $kinds['created'] ?? 0, 'updated' => $kinds['updated'] ?? 0, 'deleted' => $kinds['deleted'] ?? 0]];
    }

    public function freshTimestamp(): Carbon
    {
        return Carbon::instance(app(ClockInterface::class)->now());
    }
}
