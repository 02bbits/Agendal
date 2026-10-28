<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use Closure;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class SyncTimezone
{
    public function __construct(
        private ClockInterface $clock,
        private ReminderCalculator $reminders,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('sanctum');
        $timezone = $request->header('X-Timezone');
        $storedTimezone = $user instanceof User ? $user->timezone : 'UTC';
        $request->attributes->set('timezone', $storedTimezone);
        if (! is_string($timezone) || ! in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            return $next($request);
        }

        $request->attributes->set('timezone', $timezone);
        if ($user instanceof User && $user->timezone !== $timezone) {
            $this->updateTimezone($user, $timezone);
        }

        return $next($request);
    }

    private function updateTimezone(User $user, string $timezone): void
    {
        DB::transaction(function () use ($user, $timezone): void {
            $storedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($storedUser->timezone === $timezone) {
                return;
            }

            $storedUser->timezone = $timezone;
            $storedUser->save();

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
