<?php

declare(strict_types=1);

namespace App\Services\Clock;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserTimezone
{
    public function __construct(
        private ClockInterface $clock,
        private ReminderCalculator $reminders,
    ) {}

    public function change(User $user, string $timezone): void
    {
        DB::transaction(function () use ($user, $timezone): void {
            $storedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($storedUser->timezone === $timezone) {
                return;
            }

            // Query update so updated_at comes from the injected clock, never Eloquent's Carbon::now().
            User::query()->whereKey($storedUser->id)->update([
                'timezone' => $timezone,
                'updated_at' => $this->clock->now(),
            ]);

            $tasks = DB::table('tasks')
                ->where('user_id', $user->id)
                ->whereNull('deleted_at')
                ->where('done', false)
                ->whereNotNull('due_date')
                ->where('reminder', '!=', 'none')
                ->lockForUpdate()
                ->get(['id', 'due_date', 'start_time', 'reminder']);

            foreach ($tasks as $task) {
                $remindAt = $this->reminders->compute(
                    (string) $task->due_date,
                    $task->start_time === null ? null : substr((string) $task->start_time, 0, 5),
                    (string) $task->reminder,
                    $timezone,
                );

                DB::table('tasks')->where('id', $task->id)->update([
                    'remind_at' => $remindAt,
                    'updated_at' => $this->clock->now(),
                ]);
            }
        });

        $user->timezone = $timezone;
        $user->syncOriginalAttribute('timezone');
    }
}
