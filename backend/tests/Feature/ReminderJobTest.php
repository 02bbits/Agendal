<?php

declare(strict_types=1);

use App\Models\Project;
use App\Models\PushSubscription;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Reminders\ReminderPush;
use App\Services\Reminders\SendDueReminders;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

class FakeReminderPush implements ReminderPush
{
    /** @var list<array{subscription: PushSubscription, payload: array<string, string>}> */
    public array $sent = [];

    /** @var list<string> */
    public array $gone = [];

    public bool $ready = true;

    public bool $shouldThrow = false;

    public function send(array $messages): array
    {
        if ($this->shouldThrow) {
            throw new RuntimeException('Push service error');
        }

        foreach ($messages as $msg) {
            $this->sent[] = $msg;
        }

        return $this->gone;
    }

    public function ready(): bool
    {
        return $this->ready;
    }
}

beforeEach(function () {
    $this->clock = new FrozenClock('2026-10-26T10:00:00Z');
    $this->app->instance(ClockInterface::class, $this->clock);
    $this->fakePush = new FakeReminderPush;
    $this->app->instance(ReminderPush::class, $this->fakePush);
});

it('T-TK-51: sends once and a second run sends nothing', function () {
    $user = User::factory()->create();
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.com/sub/1',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    $taskId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Submit report',
        'start_date' => '2026-10-26',
        'start_time' => '10:00',
        'reminder' => 'none',
        'remind_at' => '2026-10-26 10:00:00+00',
        'field_updated_at' => [],
    ]);

    $service = app(SendDueReminders::class);

    $claimed1 = $service->run();
    expect($claimed1)->toBe(1)
        ->and($this->fakePush->sent)->toHaveCount(1)
        ->and($this->fakePush->sent[0]['payload']['title'])->toBe('Submit report');

    $this->fakePush->sent = [];
    $claimed2 = $service->run();
    expect($claimed2)->toBe(0)
        ->and($this->fakePush->sent)->toBeEmpty();
});

it('sends to every subscription of the user and other users get nothing', function () {
    $userA = User::factory()->create();
    $userB = User::factory()->create();

    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $userA->id,
        'endpoint' => 'https://push.example.com/sub/a1',
        'keys' => ['p256dh' => 'k1', 'auth' => 'a1'],
    ]);
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $userA->id,
        'endpoint' => 'https://push.example.com/sub/a2',
        'keys' => ['p256dh' => 'k2', 'auth' => 'a2'],
    ]);
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $userB->id,
        'endpoint' => 'https://push.example.com/sub/b1',
        'keys' => ['p256dh' => 'kb', 'auth' => 'ab'],
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $userA->id,
        'title' => 'Task for A',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 10:00:00+00',
        'field_updated_at' => [],
    ]);

    $service = app(SendDueReminders::class);
    $service->run();

    expect($this->fakePush->sent)->toHaveCount(2);
    $endpoints = array_map(fn ($m) => $m['subscription']->endpoint, $this->fakePush->sent);
    expect($endpoints)->toContain('https://push.example.com/sub/a1')
        ->toContain('https://push.example.com/sub/a2')
        ->not->toContain('https://push.example.com/sub/b1');
});

it('T-TK-112: 11 minutes late skipped, 9 minutes late sent', function () {
    $user = User::factory()->create();
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.com/sub/timing',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    // Now is 10:00:00. 9 min late: 09:51:00 (within 10m window)
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Recent reminder',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 09:51:00+00',
        'field_updated_at' => [],
    ]);

    // 11 min late: 09:49:00 (more than 10m late)
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Old reminder',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 09:49:00+00',
        'field_updated_at' => [],
    ]);

    $service = app(SendDueReminders::class);
    $claimed = $service->run();

    expect($claimed)->toBe(1)
        ->and($this->fakePush->sent)->toHaveCount(1)
        ->and($this->fakePush->sent[0]['payload']['title'])->toBe('Recent reminder');
});

it('skips done and deleted tasks', function () {
    $user = User::factory()->create();
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.com/sub/filter',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    // done task
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Done task',
        'done' => true,
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 09:55:00+00',
        'field_updated_at' => [],
    ]);

    // deleted task
    $deleted = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Deleted task',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 09:55:00+00',
        'field_updated_at' => [],
    ]);
    $deleted->delete();

    $service = app(SendDueReminders::class);
    $claimed = $service->run();

    expect($claimed)->toBe(0)
        ->and($this->fakePush->sent)->toBeEmpty();
});

it('changing remind_at after a send sends again', function () {
    $user = User::factory()->create();
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.com/sub/repeat-remind',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    $task = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Rescheduled reminder',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 09:55:00+00',
        'field_updated_at' => [],
    ]);

    $service = app(SendDueReminders::class);
    expect($service->run())->toBe(1);

    // Update remind_at to a new timestamp
    $task->remind_at = '2026-10-26 09:58:00+00';
    $task->save();

    $this->fakePush->sent = [];
    expect($service->run())->toBe(1)
        ->and($this->fakePush->sent)->toHaveCount(1);
});

it('formats body for 24h, 12h, no project, no time, due-only', function () {
    $user24 = User::factory()->create(['time_format' => '24h']);
    $user12 = User::factory()->create(['time_format' => '12h']);

    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user24->id,
        'endpoint' => 'https://push.example.com/sub/24',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user12->id,
        'endpoint' => 'https://push.example.com/sub/12',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user24->id,
        'name' => 'SQL Course',
        'colour' => 'blue',
    ]);

    // 24h with project and time: 2026-10-26 is Monday
    $t1Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $t1Id,
        'user_id' => $user24->id,
        'project_id' => $project->id,
        'title' => 'T1',
        'start_date' => '2026-10-26',
        'start_time' => '14:30',
        'remind_at' => '2026-10-26 09:55:00+00',
        'field_updated_at' => [],
    ]);

    // 12h with project and time
    $project12 = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user12->id,
        'name' => 'Design System',
        'colour' => 'blue',
    ]);
    $t2Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $t2Id,
        'user_id' => $user12->id,
        'project_id' => $project12->id,
        'title' => 'T2',
        'start_date' => '2026-10-26',
        'start_time' => '09:00',
        'remind_at' => '2026-10-26 09:56:00+00',
        'field_updated_at' => [],
    ]);

    // no project
    $t3Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $t3Id,
        'user_id' => $user24->id,
        'title' => 'T3',
        'start_date' => '2026-10-26',
        'start_time' => '14:30',
        'remind_at' => '2026-10-26 09:57:00+00',
        'field_updated_at' => [],
    ]);

    // no time (defaults to 09:00)
    $t4Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $t4Id,
        'user_id' => $user24->id,
        'title' => 'T4',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 09:58:00+00',
        'field_updated_at' => [],
    ]);

    // due-only (2026-10-27 is Tuesday)
    $t5Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $t5Id,
        'user_id' => $user24->id,
        'title' => 'T5',
        'due_date' => '2026-10-27',
        'due_time' => '15:00',
        'remind_at' => '2026-10-26 09:59:00+00',
        'field_updated_at' => [],
    ]);

    $service = app(SendDueReminders::class);
    $service->run();

    $messagesByTag = collect($this->fakePush->sent)->keyBy(fn ($m) => $m['payload']['tag']);

    expect($messagesByTag[$t1Id]['payload']['body'])->toBe('Mon 14:30 · SQL Course')
        ->and($messagesByTag[$t2Id]['payload']['body'])->toBe('Mon 9:00 AM · Design System')
        ->and($messagesByTag[$t3Id]['payload']['body'])->toBe('Mon 14:30')
        ->and($messagesByTag[$t4Id]['payload']['body'])->toBe('Mon 09:00')
        ->and($messagesByTag[$t5Id]['payload']['body'])->toBe('Tue 15:00')
        ->and($messagesByTag[$t1Id]['payload']['url'])->toBe("/tasks/{$t1Id}");
});

it('deletes gone endpoints reported by the push service', function () {
    $user = User::factory()->create();
    $sub = PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.com/sub/expired',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Task',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 10:00:00+00',
        'field_updated_at' => [],
    ]);

    $this->fakePush->gone = ['https://push.example.com/sub/expired'];

    $service = app(SendDueReminders::class);
    $service->run();

    expect(PushSubscription::withoutGlobalScope('owner')->where('id', $sub->id)->exists())->toBeFalse();
});

it('a throwing sender does not stop the batch and writes the delivery', function () {
    $user = User::factory()->create();
    PushSubscription::withoutGlobalScope('owner')->create([
        'user_id' => $user->id,
        'endpoint' => 'https://push.example.com/sub/fail',
        'keys' => ['p256dh' => 'k', 'auth' => 'a'],
    ]);

    $taskId = (string) Str::uuid();
    $task = Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Failing push task',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 10:00:00+00',
        'field_updated_at' => [],
    ]);

    $this->fakePush->shouldThrow = true;

    $service = app(SendDueReminders::class);
    $claimed = $service->run();

    expect($claimed)->toBe(1);
    expect(DB::table('reminder_deliveries')->where('task_id', $task->id)->exists())->toBeTrue();
});

it('claims nothing when push is not ready', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Not ready task',
        'start_date' => '2026-10-26',
        'remind_at' => '2026-10-26 10:00:00+00',
        'field_updated_at' => [],
    ]);

    $this->fakePush->ready = false;

    $service = app(SendDueReminders::class);
    $claimed = $service->run();

    expect($claimed)->toBe(0)
        ->and(DB::table('reminder_deliveries')->where('task_id', $taskId)->exists())->toBeFalse()
        ->and($this->fakePush->sent)->toBeEmpty();
});
