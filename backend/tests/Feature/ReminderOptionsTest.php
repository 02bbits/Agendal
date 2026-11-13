<?php

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

// #154: the reminder offsets a task can have, and when each one fires (BR-12)
uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T01:12:00Z'));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
    $this->user = User::factory()->create();
});

function remindAtOf(string $id): ?string
{
    $value = DB::table('tasks')->where('id', $id)->value('remind_at');

    return $value === null ? null : (new DateTimeImmutable((string) $value))->format('Y-m-d H:i');
}

it('fires each offset before the start time (Asia/Ho_Chi_Minh, start 30 Oct 14:00 = 07:00 UTC)', function (string $reminder, string $expectedUtc) {
    $id = (string) Str::uuid();
    $this->actingAs($this->user)->postJson('/api/v1/tasks', [
        'id' => $id, 'title' => 'Call mum', 'start_date' => '2026-10-30', 'start_time' => '14:00', 'reminder' => $reminder,
    ])->assertCreated()->assertJsonPath('reminder', $reminder);

    expect(remindAtOf($id))->toBe($expectedUtc);
})->with([
    'at the start' => ['0m', '2026-10-30 07:00'],
    '5 minutes' => ['5m', '2026-10-30 06:55'],
    '10 minutes' => ['10m', '2026-10-30 06:50'],
    '15 minutes' => ['15m', '2026-10-30 06:45'],
    '30 minutes' => ['30m', '2026-10-30 06:30'],
    '1 hour' => ['1h', '2026-10-30 06:00'],
    '2 hours' => ['2h', '2026-10-30 05:00'],
    '1 day' => ['1d', '2026-10-29 07:00'],
    '2 days' => ['2d', '2026-10-28 07:00'],
    '1 week' => ['1w', '2026-10-23 07:00'],
]);

it('counts from 09:00 on the start date when there is no start time', function () {
    $id = (string) Str::uuid();
    $this->actingAs($this->user)->postJson('/api/v1/tasks', [
        'id' => $id, 'title' => 'Pay rent', 'start_date' => '2026-10-30', 'reminder' => '2h',
    ])->assertCreated();

    // 09:00 in Ho Chi Minh is 02:00 UTC, two hours earlier is 00:00
    expect(remindAtOf($id))->toBe('2026-10-30 00:00');
});

it('changes the offset with PATCH and recomputes remind_at', function () {
    $id = (string) Str::uuid();
    $this->actingAs($this->user)->postJson('/api/v1/tasks', [
        'id' => $id, 'title' => 'Gym', 'start_date' => '2026-10-30', 'start_time' => '18:00', 'reminder' => '5m',
    ])->assertCreated();

    $this->patchJson("/api/v1/tasks/{$id}", ['reminder' => '1w'])->assertOk()->assertJsonPath('reminder', '1w');

    expect(remindAtOf($id))->toBe('2026-10-23 11:00');
});

it('rejects an offset that is not in the list', function (string $reminder) {
    $this->actingAs($this->user)->postJson('/api/v1/tasks', [
        'id' => (string) Str::uuid(), 'title' => 'Bad', 'start_date' => '2026-10-30', 'reminder' => $reminder,
    ])->assertStatus(422)->assertJsonPath('error.fields.reminder.0', fn ($message) => is_string($message));
})->with(['3h', '45m', 'soon', '1y']);

it('keeps a new offset on the next occurrence of a repeating task', function () {
    $id = (string) Str::uuid();
    $this->actingAs($this->user)->postJson('/api/v1/tasks', [
        'id' => $id, 'title' => 'Standup', 'start_date' => '2026-10-23', 'start_time' => '09:00',
        'repeat' => 'daily', 'reminder' => '2h',
    ])->assertCreated();

    $next = $this->postJson("/api/v1/tasks/{$id}/complete")->assertOk()->json('next');

    expect($next)->not->toBeNull()
        ->and($next['reminder'])->toBe('2h')
        ->and(remindAtOf($next['id']))->toBe('2026-10-24 00:00');
});
