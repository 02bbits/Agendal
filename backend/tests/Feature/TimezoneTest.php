<?php

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->app->instance(ClockInterface::class, new FrozenClock('2026-10-23T01:12:00Z'));
    $this->travelTo(Carbon::instance(app(ClockInterface::class)->now()));
    Route::middleware('api')->get('/api/v1/test-timezone', function (Request $request, ClockInterface $clock) {
        $timezone = $request->attributes->get('timezone');

        return ['timezone' => $timezone, 'today' => $clock->today($timezone), 'time' => $clock->time($timezone)];
    });
});

afterEach(function () {
    $this->travelBack();
});

it('uses the device zone while the server remains in UTC', function () {
    $this->getJson('/api/v1/test-timezone', ['X-Timezone' => 'America/Los_Angeles'])
        ->assertOk()->assertExactJson(['timezone' => 'America/Los_Angeles', 'today' => '2026-10-22', 'time' => '18:12']);
    expect(config('app.timezone'))->toBe('UTC');
});

it('T-TK-111: updates the user zone and UTC reminders without moving floating task times', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $otherUser = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $taskId = (string) Str::uuid();
    $otherTaskId = (string) Str::uuid();
    foreach ([[$taskId, $user->id], [$otherTaskId, $otherUser->id]] as [$id, $userId]) {
        DB::table('tasks')->insert([
            'id' => $id, 'user_id' => $userId, 'title' => 'SQL quiz',
            'start_date' => '2026-10-26', 'due_date' => '2026-10-26', 'start_time' => '09:00', 'due_time' => '10:00',
            'reminder' => '15m', 'remind_at' => '2026-10-26T01:45:00Z',
        ]);
    }
    $this->actingAs($user, 'web');
    // Real Carbon time from here on: timestamps must come from the injected clock.
    $this->travelBack();

    $this->getJson('/api/v1/me', ['X-Timezone' => 'Asia/Tokyo'])->assertOk()->assertJsonPath('timezone', 'Asia/Tokyo');

    expect($user->fresh()->timezone)->toBe('Asia/Tokyo')
        ->and($user->fresh()->updated_at->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-23T01:12:00Z');
    $task = DB::table('tasks')->find($taskId);
    expect((new DateTimeImmutable($task->updated_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-23T01:12:00Z');
    expect($task->due_date)->toBe('2026-10-26')
        ->and($task->start_time)->toBe('09:00:00')
        ->and($task->due_time)->toBe('10:00:00')
        ->and((new DateTimeImmutable($task->remind_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-25T23:45:00Z');
    $otherTask = DB::table('tasks')->find($otherTaskId);
    expect((new DateTimeImmutable($otherTask->remind_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-26T01:45:00Z')
        ->and($otherUser->fresh()->timezone)->toBe('Asia/Ho_Chi_Minh');
});

it('T-TK-110 (TK-E10): a date moved into a DST gap: reminder moves to the next valid minute, the floating time stays', function () {
    $user = User::factory()->create(['timezone' => 'America/New_York']);
    $taskId = (string) Str::uuid();
    DB::table('tasks')->insert([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'DST Gap Task',
        'due_date' => '2026-03-01',
        'due_time' => '02:30',
        'reminder' => '15m',
        'remind_at' => '2026-03-01T07:15:00Z',
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'due_date' => '2026-03-08',
    ])->assertStatus(200);

    $task = DB::table('tasks')->find($taskId);
    expect($task->due_date)->toBe('2026-03-08')
        ->and($task->due_time)->toBe('02:30:00')
        ->and((new DateTimeImmutable($task->remind_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-03-08T06:45:00Z');
});

it('T-LV-102 (LV-E2): changing the X-Timezone header moves Today, and stored floating dates do not change', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $taskId = (string) Str::uuid();

    DB::table('tasks')->insert([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Floating date task',
        'due_date' => '2026-10-23',
    ]);

    $res1 = $this->actingAs($user)->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh')
        ->getJson('/api/v1/tasks?view=inbox')->assertStatus(200);
    $todayIds1 = collect($res1->json('today'))->pluck('id')->all();
    expect($todayIds1)->toContain($taskId);

    $res2 = $this->actingAs($user)->withHeader('X-Timezone', 'America/Los_Angeles')
        ->getJson('/api/v1/tasks?view=inbox')->assertStatus(200);
    $todayIds2 = collect($res2->json('today'))->pluck('id')->all();
    expect($todayIds2)->not->toContain($taskId);

    $task = DB::table('tasks')->find($taskId);
    expect($task->due_date)->toBe('2026-10-23');
});

it('does not rewrite reminders when the timezone is unchanged', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Tokyo']);
    $id = (string) Str::uuid();
    DB::table('tasks')->insert(['id' => $id, 'user_id' => $user->id, 'title' => 'Quiz', 'due_date' => '2026-10-26', 'reminder' => '1h']);
    $sequence = DB::table('tasks')->where('id', $id)->value('change_seq');
    $this->actingAs($user, 'web');

    $this->getJson('/api/v1/me', ['X-Timezone' => 'Asia/Tokyo'])->assertOk();

    expect(DB::table('tasks')->where('id', $id)->value('change_seq'))->toBe($sequence);
});

it('ignores invalid or missing headers and keeps the stored zone', function (?string $timezone) {
    $user = User::factory()->create(['timezone' => 'Europe/Berlin']);
    $this->actingAs($user, 'web');
    $headers = $timezone === null ? [] : ['X-Timezone' => $timezone];

    $this->getJson('/api/v1/test-timezone', $headers)->assertOk()->assertJsonPath('timezone', 'Europe/Berlin');
    expect($user->fresh()->timezone)->toBe('Europe/Berlin');
})->with([null, 'Invalid/Zone', '+07:00', str_repeat('x', 200)]);

it('clears stale timezone state between guest requests', function () {
    $this->getJson('/api/v1/test-timezone', ['X-Timezone' => 'Asia/Tokyo'])->assertOk()->assertJsonPath('timezone', 'Asia/Tokyo');
    $this->getJson('/api/v1/test-timezone')->assertOk()->assertJsonPath('timezone', 'UTC');
});

it('recalculates date-only reminders and skips completed, deleted, and unscheduled tasks', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $ids = [];
    foreach ([
        'date-only' => [],
        'completed' => ['done' => true],
        'deleted' => ['deleted_at' => app(ClockInterface::class)->now()],
        'unscheduled' => ['due_date' => null, 'remind_at' => null],
        'disabled' => ['reminder' => 'none', 'remind_at' => null],
    ] as $name => $overrides) {
        $id = (string) Str::uuid();
        $ids[$name] = $id;
        DB::table('tasks')->insert(array_merge([
            'id' => $id, 'user_id' => $user->id, 'title' => $name,
            'due_date' => '2026-10-26', 'reminder' => '1h', 'remind_at' => '2026-10-26T01:00:00Z',
        ], $overrides));
    }
    $this->actingAs($user, 'web');

    $this->getJson('/api/v1/me', ['X-Timezone' => 'Asia/Tokyo'])->assertOk();

    $readReminder = fn (string $name) => DB::table('tasks')->where('id', $ids[$name])->value('remind_at');
    expect((new DateTimeImmutable($readReminder('date-only')))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-25T23:00:00Z')
        ->and((new DateTimeImmutable($readReminder('completed')))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-26T01:00:00Z')
        ->and((new DateTimeImmutable($readReminder('deleted')))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-26T01:00:00Z')
        ->and($readReminder('unscheduled'))->toBeNull()
        ->and($readReminder('disabled'))->toBeNull();
});

it('recalculates reminders for tasks with start date only when timezone changes', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $id = (string) Str::uuid();
    DB::table('tasks')->insert([
        'id' => $id, 'user_id' => $user->id, 'title' => 'Start date only quiz',
        'start_date' => '2026-10-26', 'start_time' => '09:00', 'due_date' => null, 'due_time' => null,
        'reminder' => '15m', 'remind_at' => '2026-10-26T01:45:00Z',
    ]);
    $this->actingAs($user, 'web');

    $this->getJson('/api/v1/me', ['X-Timezone' => 'Asia/Tokyo'])->assertOk();

    $task = DB::table('tasks')->find($id);
    expect((new DateTimeImmutable($task->remind_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-25T23:45:00Z');
});

it('uses the injected clock for demo project timestamps', function () {
    $this->seed();
    $timestamp = DB::table('projects')->value('created_at');
    expect((new DateTimeImmutable($timestamp))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-23T01:12:00Z');
});
