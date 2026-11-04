<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Reminders\SendDueReminders;
use Illuminate\Console\Command;

class SendReminders extends Command
{
    protected $signature = 'reminders:send';

    protected $description = 'Send due reminders via web push';

    public function handle(SendDueReminders $sender): int
    {
        $claimed = $sender->run();
        $this->info("Claimed {$claimed} reminders.");

        return self::SUCCESS;
    }
}
