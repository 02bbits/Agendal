<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\OwnedByUser;
use App\Services\Clock\ClockInterface;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property array<string, string> $field_updated_at
 * @property string|null $repeat_rule
 */
class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory, HasUuids, OwnedByUser, SoftDeletes;

    public const PATCHABLE = [
        'title',
        'start_date',
        'due_date',
        'start_time',
        'due_time',
        'priority',
        'reminder',
        'due_reminder',
        'repeat',
        'repeat_rule',
        'notes',
        'project_id',
        'project_order',
        'day_order',
    ];

    public const OPEN_LIMIT = 5000;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'title',
        'start_date',
        'due_date',
        'start_time',
        'due_time',
        'priority',
        'reminder',
        'due_reminder',
        'repeat',
        'repeat_rule',
        'notes',
        'project_id',
        'project_order',
        'day_order',
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
            'due_remind_at' => 'immutable_datetime',
            'deleted_at' => 'immutable_datetime',
        ];
    }

    public function freshTimestamp(): Carbon
    {
        return Carbon::instance(app(ClockInterface::class)->now());
    }
}
