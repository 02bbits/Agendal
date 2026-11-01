<?php

use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $clock = Mockery::mock(ClockInterface::class);
    $clock->shouldReceive('now')->andReturn(new DateTimeImmutable('2026-11-01T15:11:00Z'));
    $clock->shouldReceive('today')->andReturn('2026-11-01');
    $clock->shouldReceive('time')->andReturn('22:11');
    $this->app->instance(ClockInterface::class, $clock);
    config(['notes.engine_budget_ms' => 60_000]);
    $this->actingAs(User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']));
});

it('persists selected weekdays and advances the same series without duplicate children', function () {
    $input = ['client_id' => (string) Str::uuid(), 'text' => 'tập gym 2 4 6 hàng tuần', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];
    $created = $this->postJson('/api/v1/notes', $input)->assertCreated()
        ->assertJsonPath('changes.0.task.due_date', '2026-11-02')
        ->assertJsonPath('changes.0.task.repeat_rule', 'FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,WE,FR');
    $id = $created->json('changes.0.task.id');
    $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()
        ->assertJsonPath('next.due_date', '2026-11-04')->json('next.id');
    $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.id', $next);
    $this->postJson("/api/v1/tasks/$next/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.due_date', '2026-11-06');
    $this->postJson('/api/v1/notes', $input)->assertOk()->assertJsonPath('changes.0.task.id', $id);
    expect(Task::count())->toBe(3)->and(Task::findOrFail($next)->repeat_anchor)->toBe('2026-11-02');
});

it('stops persisted series after the requested count', function () {
    $response = $this->postJson('/api/v1/notes', ['client_id' => (string) Str::uuid(), 'text' => 'gym every 3 days for 3 occurrences', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertCreated();
    $id = $response->json('changes.0.task.id');
    $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.due_date', '2026-11-04')->json('next.id');
    $last = $this->postJson("/api/v1/tasks/$next/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.due_date', '2026-11-07')->json('next.id');
    $this->postJson("/api/v1/tasks/$last/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonMissingPath('next');
    expect(Task::count())->toBe(3);
});

it('advances monthly ordinal weekdays and clears a custom rule when the frequency is replaced', function () {
    $response = $this->postJson('/api/v1/notes', ['client_id' => (string) Str::uuid(), 'text' => 'test every second monday of month', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertCreated()
        ->assertJsonPath('changes.0.task.due_date', '2026-11-09');
    $id = $response->json('changes.0.task.id');
    $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.due_date', '2026-12-14')->json('next.id');
    $this->patchJson("/api/v1/tasks/$next", ['repeat' => 'daily', 'at' => '2026-11-01T15:11:01Z'])->assertOk();
    expect(Task::findOrFail($next)->repeat_rule)->toBeNull();
});

it('keeps local time across daylight saving and recalculates the reminder instant', function () {
    auth()->user()->forceFill(['timezone' => 'America/New_York'])->save();
    $response = $this->withHeader('X-Timezone', 'America/New_York')->postJson('/api/v1/tasks', [
        'id' => (string) Str::uuid(), 'title' => 'Gym', 'due_date' => '2026-10-31', 'start_time' => '09:00',
        'repeat' => 'daily', 'repeat_rule' => 'FREQ=DAILY', 'reminder' => '15m',
    ])->assertCreated();
    $id = $response->json('id');
    $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()
        ->assertJsonPath('next.due_date', '2026-11-01')->assertJsonPath('next.start_time', '09:00')->json('next.id');
    expect(Task::findOrFail($id)->remind_at->format('Y-m-d H:i'))->toBe('2026-10-31 12:45')
        ->and(Task::findOrFail($next)->remind_at->format('Y-m-d H:i'))->toBe('2026-11-01 13:45');
});

it('does not restart an exhausted series when an old occurrence is completed late', function () {
    $response = $this->postJson('/api/v1/notes', ['client_id' => (string) Str::uuid(), 'text' => 'gym every 3 days for 3 occurrences', 'written_at' => '2026-10-23T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertCreated();
    $id = $response->json('changes.0.task.id');
    $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonMissingPath('next');
    expect(Task::count())->toBe(1);
});
