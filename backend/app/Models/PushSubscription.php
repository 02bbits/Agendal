<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One device that gets reminders (TK-6). The endpoint is unique: signing in to another account
 * on the same browser moves it there (TK §2.5).
 *
 * @property int $id
 * @property int $user_id
 * @property string $endpoint
 * @property array{p256dh: string, auth: string} $keys
 */
class PushSubscription extends Model
{
    /** @var list<string> */
    protected $fillable = ['user_id', 'endpoint', 'keys'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['keys' => 'array'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
