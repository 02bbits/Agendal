<?php

declare(strict_types=1);

namespace App\Services\Reminders;

use App\Models\PushSubscription;

interface ReminderPush
{
    /**
     * @param  list<array{subscription: PushSubscription, payload: array<string, string>}>  $messages
     * @return list<string> endpoints the push service says are gone
     */
    public function send(array $messages): array;

    public function ready(): bool;
}
