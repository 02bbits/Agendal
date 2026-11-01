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
            'due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '10:00',
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
        ->and($task->end_time)->toBe('10:00:00')
        ->and((new DateTimeImmutable($task->remind_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-25T23:45:00Z');
    $otherTask = DB::table('tasks')->find($otherTaskId);
    expect((new DateTimeImmutable($otherTask->remind_at))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-26T01:45:00Z')
        ->and($otherUser->fresh()->timezone)->toBe('Asia/Ho_Chi_Minh');
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

it('uses the injected clock for demo project timestamps', function () {
    $this->seed();
    $timestamp = DB::table('projects')->value('created_at');
    expect((new DateTimeImmutable($timestamp))->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-23T01:12:00Z');
});
