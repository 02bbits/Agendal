<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use App\Services\Clock\ClockInterface;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property array<string, string> $field_updated_at
 */
class Task extends Model
{
    use HasUuids, OwnedByUser, SoftDeletes;

    public const PATCHABLE = [
        'title',
        'due_date',
        'start_time',
        'end_time',
        'priority',
        'reminder',
        'repeat',
        'notes',
        'project_id',
    ];

    public const OPEN_LIMIT = 5000;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'title',
        'due_date',
        'start_time',
        'end_time',
        'priority',
        'reminder',
        'repeat',
        'notes',
        'project_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'done' => 'boolean',
            'field_updated_at' => 'array',
            'done_at' => 'immutable_datetime',
            'remind_at' => 'immutable_datetime',
            'deleted_at' => 'immutable_datetime',
        ];
    }

    public function freshTimestamp(): Carbon
    {
        return Carbon::instance(app(ClockInterface::class)->now());
    }
}
