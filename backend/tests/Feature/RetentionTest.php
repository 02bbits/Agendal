<?php

use App\Models\User;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Str;

// IM-55, T-AP-41: the daily retention jobs (scalability.md, Retention)
uses(RefreshDatabase::class);

function scheduled(string $match): Event
{
    $event = collect(Schedule::events())->first(fn ($e) => $e->description === $match || str_contains((string) $e->command, $match));
    expect($event)->not->toBeNull();

    return $event;
}

it('T-AP-41: every retention job is scheduled daily', function () {
    foreach (['sync:purge', 'auth:clear-resets', 'purge-audit-events', 'purge-email-codes', 'purge-reminder-deliveries'] as $job) {
        expect(scheduled($job)->expression)->toBe('0 0 * * *');
    }
});

it('T-AP-41: email codes go a day after they expire, and not before', function () {
    [$old, $fresh] = User::factory()->count(2)->create();
    foreach ([[$old, 25], [$fresh, 23]] as [$user, $hours]) {
        DB::table('email_verification_codes')->insert([
            'user_id' => $user->id, 'code_hash' => str_repeat('a', 64), 'sent_at' => now(), 'expires_at' => now()->subHours($hours),
        ]);
    }
    scheduled('purge-email-codes')->run(app());

    expect(DB::table('email_verification_codes')->pluck('user_id')->all())->toBe([$fresh->id]);
});

it('T-AP-41: reminder sends go after 30 days, and not before', function () {
    $task = (string) Str::uuid();
    DB::table('tasks')->insert(['id' => $task, 'user_id' => User::factory()->create()->id, 'title' => 'Call mum']);
    foreach ([29, 31] as $days) {
        DB::table('reminder_deliveries')->insert(['task_id' => $task, 'remind_at' => now()->subDays($days), 'sent_at' => now()->subDays($days)]);
    }
    scheduled('purge-reminder-deliveries')->run(app());

    expect(DB::table('reminder_deliveries')->count())->toBe(1)
        ->and(DB::table('reminder_deliveries')->where('sent_at', '<', now()->subDays(30))->exists())->toBeFalse();
});
