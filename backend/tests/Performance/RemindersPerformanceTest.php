<?php

declare(strict_types=1);

namespace Tests\Performance;

use App\Models\PushSubscription;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Reminders\ReminderPush;
use App\Services\Reminders\SendDueReminders;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

class FakePerfReminderPush implements ReminderPush
{
    /** @var list<array{subscription: PushSubscription, payload: array<string, string>}> */
    public array $sent = [];

    public function send(array $messages): array
    {
        foreach ($messages as $msg) {
            $this->sent[] = $msg;
        }

        return [];
    }

    public function ready(): bool
    {
        return true;
    }
}

it('PERF-03: reminder processing under load (300 tasks across 30 users under 60s)', function () {
    $nowStr = '2026-10-26T10:00:00Z';
    $clock = new FrozenClock($nowStr);
    $this->app->instance(ClockInterface::class, $clock);

    $fakePush = new FakePerfReminderPush;
    $this->app->instance(ReminderPush::class, $fakePush);

    $users = User::factory()->count(30)->create(['timezone' => 'UTC']);
    $remindAt = '2026-10-26 09:59:00+00';

    $taskRecords = [];
    foreach ($users as $idx => $user) {
        PushSubscription::withoutGlobalScope('owner')->create([
            'user_id' => $user->id,
            'endpoint' => "https://push.example.com/sub/perf-{$idx}",
            'keys' => ['p256dh' => "k{$idx}", 'auth' => "a{$idx}"],
        ]);

        for ($t = 0; $t < 10; $t++) {
            $taskRecords[] = [
                'id' => (string) Str::uuid7(),
                'user_id' => $user->id,
                'title' => "Reminder task {$idx}-{$t}",
                'due_date' => '2026-10-26',
                'start_time' => null,
                'due_time' => '10:00',
                'reminder' => 'none',
                'remind_at' => $remindAt,
                'repeat' => 'never',
                'done' => false,
                'field_updated_at' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
    }

    DB::table('tasks')->insert($taskRecords);

    try {
        $service = app(SendDueReminders::class);

        $t0 = hrtime(true);
        $claimed1 = $service->run();
        $elapsed1 = (hrtime(true) - $t0) / 1_000_000_000; // seconds

        fwrite(STDOUT, sprintf("reminders: run1_claimed=%d, elapsed=%.4fs\n", $claimed1, $elapsed1));

        expect($claimed1)->toBe(300)
            ->and($fakePush->sent)->toHaveCount(300)
            ->and(collect($fakePush->sent)->pluck('payload.tag')->unique())->toHaveCount(300)
            ->and(DB::table('reminder_deliveries')->count())->toBe(300)
            ->and($elapsed1)->toBeLessThan(60.0);

        // Run second time: returns 0 and no new messages
        $t1 = hrtime(true);
        $claimed2 = $service->run();
        $elapsed2 = (hrtime(true) - $t1) / 1_000_000_000;

        fwrite(STDOUT, sprintf("reminders: run2_claimed=%d, elapsed=%.4fs\n", $claimed2, $elapsed2));

        expect($claimed2)->toBe(0)
            ->and($fakePush->sent)->toHaveCount(300);
    } finally {
        $userIds = $users->pluck('id')->all();
        DB::table('reminder_deliveries')->delete();
        DB::table('tasks')->whereIn('user_id', $userIds)->delete();
        PushSubscription::withoutGlobalScope('owner')->whereIn('user_id', $userIds)->delete();
        User::whereIn('id', $userIds)->delete();
    }
});
