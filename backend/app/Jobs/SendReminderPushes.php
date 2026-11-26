<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\Push\ReminderSender;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Sends a batch of claimed reminders (TK §2.5). Off the scheduler, so a slow push service never
 * holds up the next minute's claim. It runs once: ReminderSender tries temporary failures again
 * itself, for the failed devices only, so no device gets a reminder twice.
 */
class SendReminderPushes implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    /**
     * @param  list<array{task_id: string, remind_at: string}>  $deliveries
     * @param  list<string>|null  $onlyEndpoints
     */
    public function __construct(
        public array $deliveries,
        public int $attempt = 0,
        public ?array $onlyEndpoints = null,
    ) {}

    public function handle(ReminderSender $sender): void
    {
        $sender->send($this->deliveries, $this->attempt, $this->onlyEndpoints);
    }
}
