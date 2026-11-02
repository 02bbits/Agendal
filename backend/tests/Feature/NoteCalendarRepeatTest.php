<?php

use App\Models\Note;
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
        ->assertJsonPath('changes.0.task.repeat_anchor', '2026-11-02')
        ->assertJsonMissingPath('changes.0.task.repeat_description')
        ->assertJsonPath('changes.0.task.repeat_rule', 'FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,WE,FR');
    $id = $created->json('changes.0.task.id');
    $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()
        ->assertJsonPath('next.due_date', '2026-11-04')->json('next.id');
    $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.id', $next);
    $this->postJson("/api/v1/tasks/$next/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.due_date', '2026-11-06');
    $note = Note::findOrFail($created->json('note.id'));
    $plan = $note->plan;
    $plan['changes'][0]['task']['repeat_description'] = 'Old server description';
    $note->plan = $plan;
    $note->save();
    $this->postJson('/api/v1/notes', $input)->assertOk()->assertJsonPath('changes.0.task.id', $id)
        ->assertJsonMissingPath('changes.0.task.repeat_description');
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

it('undoes the generated occurrence and recompletes it using the current schedule', function () {
    $created = $this->postJson('/api/v1/notes', ['client_id' => (string) Str::uuid(), 'text' => 'tập gym 2 4 6 hàng tuần', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertCreated();
    $id = $created->json('changes.0.task.id');
    $child = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->json('next.id');
    $this->postJson("/api/v1/tasks/$id/reopen", ['at' => '2026-11-01T15:11:02Z'])->assertOk()->assertJsonPath('next.id', $child);
    expect(Task::withTrashed()->findOrFail($child)->trashed())->toBeTrue();
    $this->patchJson("/api/v1/tasks/$id", ['repeat' => 'daily', 'at' => '2026-11-01T15:11:03Z'])->assertOk();
    $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:04Z'])->assertOk()
        ->assertJsonPath('next.id', $child)->assertJsonPath('next.due_date', '2026-11-03')->assertJsonPath('next.repeat', 'daily');
    expect(Task::count())->toBe(2)->and(Task::withTrashed()->count())->toBe(2);
});

it('does not resurrect a deliberately deleted next occurrence on a completion retry', function () {
    $created = $this->postJson('/api/v1/notes', ['client_id' => (string) Str::uuid(), 'text' => 'gym every Monday', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertCreated();
    $id = $created->json('changes.0.task.id');
    $child = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->json('next.id');
    $this->deleteJson("/api/v1/tasks/$child?scope=one")->assertNoContent();
    $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonMissingPath('next');
    expect(Task::withTrashed()->findOrFail($child)->trashed())->toBeTrue();
});

it('persists three independent daily series and replays the same note without creating more', function () {
    $input = ['client_id' => (string) Str::uuid(), 'text' => 'visit house 3 times every day', 'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];
    $response = $this->postJson('/api/v1/notes', $input)->assertCreated()
        ->assertJsonPath('note.status', 'done')->assertJsonCount(3, 'changes');
    $ids = array_column(array_column($response->json('changes'), 'task'), 'id');
    expect(array_unique($ids))->toHaveCount(3);
    foreach ($ids as $i => $id) {
        $task = Task::findOrFail($id);
        expect($task->title)->toBe('Visit house ('.($i + 1).'/3)')
            ->and($task->start_time)->toBeNull()->and($task->repeat_rule)->toBe('FREQ=DAILY;INTERVAL=1;WKST=MO');
        $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()
            ->assertJsonPath('next.due_date', '2026-11-02')->json('next.id');
        $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.id', $next);
    }
    $this->postJson('/api/v1/notes', [...$input, 'text' => 'ignored replay'])->assertOk()->assertJsonCount(3, 'changes');
    expect(Task::count())->toBe(6);
});

it('applies a comma-separated monthly calendar as one series', function () {
    $response = $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'gym every month on day 1, 15, 25',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonCount(1, 'changes')
        ->assertJsonPath('changes.0.task.repeat_rule', 'FREQ=MONTHLY;INTERVAL=1;WKST=MO;BYMONTHDAY=1,15,25');
    $id = $response->json('changes.0.task.id');
    $next = $this->postJson("/api/v1/tasks/$id/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()
        ->assertJsonPath('next.due_date', '2026-11-15')->json('next.id');
    $this->postJson("/api/v1/tasks/$next/complete", ['at' => '2026-11-01T15:11:01Z'])->assertOk()->assertJsonPath('next.due_date', '2026-11-25');
});

it('rejects multiplicity exceeding one note limit without persisting partial tasks', function () {
    $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'gym 20 times every day; visit house 20 times every day',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertUnprocessable()->assertJsonPath('error.code', 'note.too_many_items');
    expect(Task::count())->toBe(0)->and(Note::count())->toBe(0);
});

it('applies a spelled relative time and a date-led shopping list without phantom items', function () {
    $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(),
        'text' => 'nhớ gọi mẹ sau nửa tiếng để hỏi thăm sức khỏe; ngày mai mua sữa, trứng và bánh mì',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonCount(2, 'changes')
        ->assertJsonPath('changes.0.task.title', 'Gọi mẹ để hỏi thăm sức khỏe')
        ->assertJsonPath('changes.0.task.due_date', '2026-11-01')
        ->assertJsonPath('changes.0.task.start_time', '22:41')
        ->assertJsonPath('changes.1.task.title', 'Mua sữa, trứng và bánh mì')
        ->assertJsonPath('changes.1.task.due_date', '2026-11-02');
    expect(Task::count())->toBe(2);
});

it('applies scheduling fragments as three independent weekly tasks', function () {
    $response = $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'lặp lại 3 lần, gọi mẹ, thứ 3 mỗi tuần',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonCount(3, 'changes');
    foreach ($response->json('changes') as $i => $change) {
        expect($change['task']['title'])->toBe('Gọi mẹ ('.($i + 1).'/3)')
            ->and($change['task']['due_date'])->toBe('2026-11-03')
            ->and($change['task']['repeat_rule'])->toContain('BYDAY=TU');
    }
    expect(Task::count())->toBe(3);
});

it('retains unsupported exclusions without applying the excluded date as a schedule', function () {
    $text = 'tập plank mỗi thứ 3 hàng tuần, trừ ngày 10/11/2026 và 24/11/2026 vì đi công tác';
    $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => $text.'; buy milk tomorrow',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonCount(2, 'changes')
        ->assertJsonPath('changes.0.task.title', mb_strtoupper(mb_substr($text, 0, 1)).mb_substr($text, 1))
        ->assertJsonPath('changes.0.task.due_date', null)
        ->assertJsonPath('changes.0.task.repeat', 'never')
        ->assertJsonPath('changes.0.task.repeat_rule', null)
        ->assertJsonPath('changes.1.task.due_date', '2026-11-02');
});

it('does not persist a shifted timestamp when a relative time conflicts with the weekly day', function () {
    $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'call mum in half an hour every Tuesday',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonCount(1, 'changes')
        ->assertJsonPath('changes.0.task.title', 'Call mum in half an hour every Tuesday')
        ->assertJsonPath('changes.0.task.due_date', null)
        ->assertJsonPath('changes.0.task.start_time', null)
        ->assertJsonPath('changes.0.task.repeat', 'never');
});

it('persists hour aliases and fractional suffixes across midnight', function () {
    $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'gọi mẹ sau một giờ rưỡi; gọi bố sau hai giờ',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonCount(2, 'changes')
        ->assertJsonPath('changes.0.task.title', 'Gọi mẹ')
        ->assertJsonPath('changes.0.task.due_date', '2026-11-01')
        ->assertJsonPath('changes.0.task.start_time', '23:41')
        ->assertJsonPath('changes.1.task.title', 'Gọi bố')
        ->assertJsonPath('changes.1.task.due_date', '2026-11-02')
        ->assertJsonPath('changes.1.task.start_time', '00:11');
});
