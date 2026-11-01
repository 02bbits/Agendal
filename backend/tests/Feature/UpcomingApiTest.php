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
        'due_date' => '2026-10-24',
        'start_time' => '10:00:00',
        'end_time' => '12:00:00',
        'done' => false,
    ]);

    // Sun 25 Oct tasks (one timed, one untimed)
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Plan the week',
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
        'due_date' => '2026-10-25',
        'start_time' => '10:00:00',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Due only task',
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
