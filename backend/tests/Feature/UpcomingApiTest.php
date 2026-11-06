<?php

declare(strict_types=1);

use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T01:12:00Z'));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
});

it('rejects unauthenticated requests with 401', function () {
    $this->getJson('/api/v1/tasks?view=upcoming')->assertStatus(401);
});

it('rejects invalid filter with 422', function () {
    $user = User::factory()->create();

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=unknown')
        ->assertStatus(422);

    expect($res->json('error.fields.filter'))->not->toBeEmpty();
});

it('groups open tasks by day from tomorrow and sorts within each day', function () {
    $user = User::factory()->create();

    // Today task - should be excluded from upcoming
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Today task',
        'due_date' => '2026-10-23',
        'done' => false,
    ]);

    // Tomorrow task
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Draft portfolio case study',
        'start_date' => '2026-10-24',
        'due_date' => '2026-10-24',
        'start_time' => '10:00:00',
        'due_time' => '12:00:00',
        'done' => false,
    ]);

    // Sun 25 Oct tasks (one timed, one untimed)
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Plan the week',
        'start_date' => '2026-10-25',
        'due_date' => '2026-10-25',
        'start_time' => '19:00:00',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Renew gym membership',
        'due_date' => '2026-10-25',
        'priority' => 'medium',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming')
        ->assertOk()
        ->json();

    expect($res['days'])->toHaveCount(2);
    expect($res['days'][0]['date'])->toBe('2026-10-24');
    expect($res['days'][0]['tasks'])->toHaveCount(1);
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Draft portfolio case study');

    expect($res['days'][1]['date'])->toBe('2026-10-25');
    expect($res['days'][1]['tasks'])->toHaveCount(2);
    expect($res['days'][1]['tasks'][0]['title'])->toBe('Plan the week');
    expect($res['days'][1]['tasks'][1]['title'])->toBe('Renew gym membership');
    expect($res['next_from'])->toBeNull();
});

it('supports 14-day paging and next_from', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Task A',
        'due_date' => '2026-10-24',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Task B',
        'due_date' => '2026-11-06',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Task C',
        'due_date' => '2026-11-07',
        'done' => false,
    ]);

    $firstPage = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&days=14')
        ->assertOk()
        ->json();

    expect(collect($firstPage['days'])->pluck('date')->all())->toBe(['2026-10-24', '2026-11-06']);
    expect($firstPage['next_from'])->toBe('2026-11-07');

    $secondPage = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&from=2026-11-07&days=14')
        ->assertOk()
        ->json();

    expect(collect($secondPage['days'])->pluck('date')->all())->toBe(['2026-11-07']);
    expect($secondPage['next_from'])->toBeNull();
});

it('filters scheduled and due only', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Scheduled task',
        'start_date' => '2026-10-25',
        'due_date' => null,
        'start_time' => '10:00:00',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Due only task',
        'start_date' => null,
        'due_date' => '2026-10-25',
        'start_time' => null,
        'done' => false,
    ]);

    $scheduledRes = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=scheduled')
        ->assertOk()
        ->json();

    expect($scheduledRes['days'][0]['tasks'])->toHaveCount(1);
    expect($scheduledRes['days'][0]['tasks'][0]['title'])->toBe('Scheduled task');

    $dueRes = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=due')
        ->assertOk()
        ->json();

    expect($dueRes['days'][0]['tasks'])->toHaveCount(1);
    expect($dueRes['days'][0]['tasks'][0]['title'])->toBe('Due only task');
});

it('shows a task start Thu, due Sat under both days in all', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Span task',
        'start_date' => '2026-10-29',
        'due_date' => '2026-10-31',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=all')
        ->assertOk()
        ->json();

    expect($res['days'])->toHaveCount(2);
    expect($res['days'][0]['date'])->toBe('2026-10-29');
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Span task');
    expect($res['days'][1]['date'])->toBe('2026-10-31');
    expect($res['days'][1]['tasks'][0]['title'])->toBe('Span task');
    expect($res['total_count'])->toBe(1);
});

it('shows a task once when start and due are the same day', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Same day task',
        'start_date' => '2026-10-25',
        'due_date' => '2026-10-25',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=all')
        ->assertOk()
        ->json();

    expect($res['days'])->toHaveCount(1);
    expect($res['days'][0]['date'])->toBe('2026-10-25');
    expect($res['days'][0]['tasks'])->toHaveCount(1);
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Same day task');
});

it('shows a start-only task on its start date', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Start only task',
        'start_date' => '2026-10-26',
        'due_date' => null,
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming')
        ->assertOk()
        ->json();

    expect($res['days'])->toHaveCount(1);
    expect($res['days'][0]['date'])->toBe('2026-10-26');
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Start only task');
});

it('shows start day only in scheduled filter, including task with start date and no time, while due-only task is excluded', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Span task',
        'start_date' => '2026-10-29',
        'due_date' => '2026-10-31',
        'done' => false,
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Untimed start task',
        'start_date' => '2026-10-26',
        'start_time' => null,
        'done' => false,
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Due only task',
        'due_date' => '2026-10-27',
        'start_date' => null,
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=scheduled')
        ->assertOk()
        ->json();

    $dates = collect($res['days'])->pluck('date')->all();
    expect($dates)->toBe(['2026-10-26', '2026-10-29']);
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Untimed start task');
    expect($res['days'][1]['tasks'][0]['title'])->toBe('Span task');
    expect(collect($res['days'])->flatMap(fn ($d) => $d['tasks'])->pluck('title'))->not->toContain('Due only task');
});

it('shows due day only in due filter, including task with start time', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Span task with start time',
        'start_date' => '2026-10-29',
        'due_date' => '2026-10-31',
        'start_time' => '10:00:00',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=due')
        ->assertOk()
        ->json();

    expect($res['days'])->toHaveCount(1);
    expect($res['days'][0]['date'])->toBe('2026-10-31');
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Span task with start time');
});

it('shows a task whose start date has passed only under its due day', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Passed start task',
        'start_date' => '2026-10-20',
        'due_date' => '2026-10-25',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming')
        ->assertOk()
        ->json();

    expect($res['days'])->toHaveCount(1);
    expect($res['days'][0]['date'])->toBe('2026-10-25');
    expect($res['days'][0]['tasks'][0]['title'])->toBe('Passed start task');
});

it('never shows a done task or another user task', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Done task',
        'start_date' => '2026-10-25',
        'due_date' => '2026-10-26',
        'done' => true,
        'done_at' => now(),
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $other->id,
        'title' => 'Other user task',
        'start_date' => '2026-10-25',
        'due_date' => '2026-10-26',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming')
        ->assertOk()
        ->json();

    expect($res['days'])->toBeEmpty();
    expect($res['total_count'])->toBe(0);
});

it('counts a two-day task once in total_count and next_from works with days=2', function () {
    $user = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Span task',
        'start_date' => '2026-10-24',
        'due_date' => '2026-10-28',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&days=2')
        ->assertOk()
        ->json();

    expect($res['total_count'])->toBe(1);
    expect($res['days'])->toHaveCount(1);
    expect($res['days'][0]['date'])->toBe('2026-10-24');
    expect($res['next_from'])->toBe('2026-10-28');
});

it('excludes soft-deleted, done, and other user tasks', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Done task',
        'due_date' => '2026-10-25',
        'done' => true,
        'done_at' => now(),
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Deleted task',
        'due_date' => '2026-10-25',
        'done' => false,
        'deleted_at' => now(),
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $other->id,
        'title' => 'Other user task',
        'due_date' => '2026-10-25',
        'done' => false,
    ]);

    $res = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming')
        ->assertOk()
        ->json();

    expect($res['days'])->toBeEmpty();
});

it('filter scheduled includes repeating tasks with no start date on their due day', function () {
    $user = User::factory()->create();

    // Repeating task with no start date and due_date >= tomorrow
    $repeatingDueOnlyId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $repeatingDueOnlyId,
        'user_id' => $user->id,
        'title' => 'Weekly review without start date',
        'start_date' => null,
        'due_date' => '2026-10-25',
        'repeat' => 'weekly',
        'done' => false,
    ]);

    // Non-repeating due-only task
    $nonRepeatingDueOnlyId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $nonRepeatingDueOnlyId,
        'user_id' => $user->id,
        'title' => 'One-time due only task',
        'start_date' => null,
        'due_date' => '2026-10-25',
        'repeat' => 'never',
        'done' => false,
    ]);

    // Standard scheduled task with start_date
    $scheduledId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $scheduledId,
        'user_id' => $user->id,
        'title' => 'Standard scheduled task',
        'start_date' => '2026-10-26',
        'due_date' => null,
        'repeat' => 'never',
        'done' => false,
    ]);

    $resScheduled = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=scheduled')
        ->assertOk()
        ->json();

    expect($resScheduled['total_count'])->toBe(2);
    $allScheduledIds = collect($resScheduled['days'])->flatMap(fn ($d) => collect($d['tasks'])->pluck('id'))->all();
    expect($allScheduledIds)->toContain($repeatingDueOnlyId)
        ->and($allScheduledIds)->toContain($scheduledId)
        ->and($allScheduledIds)->not->toContain($nonRepeatingDueOnlyId);

    $oct25 = collect($resScheduled['days'])->firstWhere('date', '2026-10-25');
    expect($oct25)->not->toBeNull();
    $oct25Ids = collect($oct25['tasks'])->pluck('id')->all();
    expect($oct25Ids)->toContain($repeatingDueOnlyId);

    $resDue = $this->actingAs($user)->getJson('/api/v1/tasks?view=upcoming&filter=due')
        ->assertOk()
        ->json();
    $allDueIds = collect($resDue['days'])->flatMap(fn ($d) => collect($d['tasks'])->pluck('id'))->all();
    expect($allDueIds)->toContain($repeatingDueOnlyId)
        ->and($allDueIds)->toContain($nonRepeatingDueOnlyId)
        ->and($allDueIds)->not->toContain($scheduledId);
});
