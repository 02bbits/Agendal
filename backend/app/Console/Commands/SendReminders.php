<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\SendReminderPushes;
use App\Services\Clock\ClockInterface;
use App\Services\Push\DueReminders;
use App\Services\Push\VapidKeys;
use Illuminate\Console\Command;

/**
 * Every minute (routes/console.php): claims the due reminders and queues them in batches
 * (TK §2.5). Without VAPID keys it claims nothing, so no reminder is used up unsent.
 */
class SendReminders extends Command
{
    protected $signature = 'reminders:send';

    protected $description = 'Claim due reminders and queue their pushes';

    public function handle(DueReminders $due, VapidKeys $keys, ClockInterface $clock): int
    {
        if (! $keys->configured()) {
            return self::SUCCESS;
        }
        $claimed = $due->claim($clock->now(), (int) config('push.claim_limit'));
        foreach (array_chunk($claimed, max(1, (int) config('push.batch'))) as $batch) {
            SendReminderPushes::dispatch($batch);
        }
        if ($claimed !== []) {
            $this->info(count($claimed).' reminders queued');
        }

        return self::SUCCESS;
    }
}
