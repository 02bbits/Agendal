<?php

declare(strict_types=1);

use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

function assertTaskSchemaInInbox(mixed $body): void
{
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', __DIR__.'/../../../docs/07-architecture/contracts/schemas/');
    $result = $validator->validate(json_decode(json_encode($body)), 'https://agendal.app/schemas/task.schema.json');

    expect($result->isValid())->toBeTrue(
        $result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error()), JSON_PRETTY_PRINT)
    );
}

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T01:12:00Z'));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
});

it('rejects unauthenticated requests with 401', function () {
    $this->getJson('/api/v1/tasks?view=inbox')->assertStatus(401);
});

it('rejects missing or unsupported view with 422', function () {
    $user = User::factory()->create();

    $resMissing = $this->actingAs($user)->getJson('/api/v1/tasks')
        ->assertStatus(422);
    expect($resMissing->json('error.fields.view'))->not->toBeEmpty();

    $resOther = $this->actingAs($user)->getJson('/api/v1/tasks?view=other')
        ->assertStatus(422);
    expect($resOther->json('error.fields.view'))->not->toBeEmpty();
});

it('never includes soft-deleted tasks or other user tasks', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    // Other user's task
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $other->id,
        'title' => 'Other user task',
        'due_date' => '2026-10-23',
        'done' => false,
    ]);

    // Current user's soft-deleted task
    $deletedTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Deleted task',
        'due_date' => '2026-10-23',
        'done' => false,
    ]);
    $deletedTask->delete();

    // Current user's visible task
    $visibleTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'My task',
        'due_date' => '2026-10-23',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/tasks?view=inbox')->assertStatus(200);

    $todayIds = collect($response->json('today'))->pluck('id')->all();
    expect($todayIds)->toBe([$visibleTask->id]);
});

it('calculates progress math according to T-LV-01 (including overdue task completed today)', function () {
    $user = User::factory()->create();

    // 1. Open overdue task (due 2026-10-20) -> in overdue, counted in total
    $overdueOpen = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Overdue open',
        'due_date' => '2026-10-20',
        'done' => false,
    ]);

    // 2. Open today task (due 2026-10-23) -> in today, counted in total
    $todayOpen = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Today open',
        'due_date' => '2026-10-23',
        'done' => false,
    ]);

    // 3. Overdue task completed today -> in completed_today, counted in done and total
    $overdueDoneToday = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Overdue done today',
        'due_date' => '2026-10-21',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23T02:00:00Z'),
    ]);

    // 4. Today task completed today -> in completed_today, counted in done and total
    $todayDoneToday = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Today done today',
        'due_date' => '2026-10-23',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23T03:00:00Z'),
    ]);

    // 5. Undated task completed today -> in completed_today, but NOT counted in progress
    $undatedDoneToday = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Undated done today',
        'due_date' => null,
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23T04:00:00Z'),
    ]);

    // 6. Future task completed today (due 2026-10-25) -> in completed_today, but NOT counted in progress
    $futureDoneToday = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Future done today',
        'due_date' => '2026-10-25',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23T05:00:00Z'),
    ]);

    // 7. Open undated task -> in no_date, NOT counted in progress
    $undatedOpen = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Undated open',
        'due_date' => null,
        'done' => false,
    ]);

    // 8. Task completed yesterday (2026-10-22 local) -> NOT in completed_today
    $doneYesterday = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Done yesterday',
        'due_date' => '2026-10-22',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-22T08:00:00Z'),
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/tasks?view=inbox')->assertStatus(200);

    // Total = open due today or overdue (2) + completed today due today or earlier (2) = 4
    // Done = 2
    expect($response->json('progress'))->toBe(['done' => 2, 'total' => 4]);

    expect(collect($response->json('overdue'))->pluck('id')->all())->toBe([$overdueOpen->id]);
    expect(collect($response->json('today'))->pluck('id')->all())->toBe([$todayOpen->id]);
    expect(collect($response->json('no_date'))->pluck('id')->all())->toBe([$undatedOpen->id]);
    expect($response->json('no_date_count'))->toBe(1);

    $completedTodayIds = collect($response->json('completed_today'))->pluck('id')->all();
    expect($completedTodayIds)->toContain($overdueDoneToday->id)
        ->toContain($todayDoneToday->id)
        ->toContain($undatedDoneToday->id)
        ->toContain($futureDoneToday->id)
        ->not->toContain($doneYesterday->id);
    expect($response->json('completed_count'))->toBe(4);

    assertTaskSchemaInInbox($response->json('today.0'));
});

it('sorts each section correctly according to T-LV-02', function () {
    $user = User::factory()->create();

    // Overdue: sorted due_date asc, then created_at asc
    $overdue1 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Overdue older due',
        'due_date' => '2026-10-20',
        'created_at' => Carbon::parse('2026-10-20 10:00:00'),
        'done' => false,
    ]);
    $overdue2 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Overdue newer due 1',
        'due_date' => '2026-10-21',
        'created_at' => Carbon::parse('2026-10-20 11:00:00'),
        'done' => false,
    ]);
    $overdue3 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Overdue newer due 2',
        'due_date' => '2026-10-21',
        'created_at' => Carbon::parse('2026-10-20 12:00:00'),
        'done' => false,
    ]);

    // Today: timed (start_time not null) first by start_time, then untimed by priority high -> medium -> low -> null, then created_at
    $todayTimedLate = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Timed late',
        'due_date' => '2026-10-23',
        'start_time' => '14:00',
        'priority' => 'low',
        'created_at' => Carbon::parse('2026-10-23 01:00:00'),
        'done' => false,
    ]);
    $todayTimedEarly = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Timed early',
        'due_date' => '2026-10-23',
        'start_time' => '09:00',
        'priority' => 'low',
        'created_at' => Carbon::parse('2026-10-23 02:00:00'),
        'done' => false,
    ]);
    $todayUntimedHigh = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Untimed high',
        'due_date' => '2026-10-23',
        'start_time' => null,
        'priority' => 'high',
        'created_at' => Carbon::parse('2026-10-23 03:00:00'),
        'done' => false,
    ]);
    $todayUntimedMedium = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Untimed medium',
        'due_date' => '2026-10-23',
        'start_time' => null,
        'priority' => 'medium',
        'created_at' => Carbon::parse('2026-10-23 04:00:00'),
        'done' => false,
    ]);
    $todayUntimedLow = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Untimed low',
        'due_date' => '2026-10-23',
        'start_time' => null,
        'priority' => 'low',
        'created_at' => Carbon::parse('2026-10-23 05:00:00'),
        'done' => false,
    ]);
    $todayUntimedNoPriority = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Untimed no priority',
        'due_date' => '2026-10-23',
        'start_time' => null,
        'priority' => null,
        'created_at' => Carbon::parse('2026-10-23 06:00:00'),
        'done' => false,
    ]);

    // No date: priority high -> medium -> low -> null, then newest first (created_at desc)
    $noDateLowOlder = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'No date low older',
        'due_date' => null,
        'priority' => 'low',
        'created_at' => Carbon::parse('2026-10-22 08:00:00'),
        'done' => false,
    ]);
    $noDateLowNewer = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'No date low newer',
        'due_date' => null,
        'priority' => 'low',
        'created_at' => Carbon::parse('2026-10-22 09:00:00'),
        'done' => false,
    ]);
    $noDateHigh = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'No date high',
        'due_date' => null,
        'priority' => 'high',
        'created_at' => Carbon::parse('2026-10-22 07:00:00'),
        'done' => false,
    ]);

    // Completed today: newest done first
    $doneFirst = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Done first',
        'due_date' => '2026-10-23',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23T01:30:00Z'),
    ]);
    $doneSecond = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Done second',
        'due_date' => '2026-10-23',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23T02:30:00Z'),
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/tasks?view=inbox')->assertStatus(200);

    expect(collect($response->json('overdue'))->pluck('id')->all())->toBe([
        $overdue1->id,
        $overdue2->id,
        $overdue3->id,
    ]);

    expect(collect($response->json('today'))->pluck('id')->all())->toBe([
        $todayTimedEarly->id,
        $todayTimedLate->id,
        $todayUntimedHigh->id,
        $todayUntimedMedium->id,
        $todayUntimedLow->id,
        $todayUntimedNoPriority->id,
    ]);

    expect(collect($response->json('no_date'))->pluck('id')->all())->toBe([
        $noDateHigh->id,
        $noDateLowNewer->id,
        $noDateLowOlder->id,
    ]);

    expect(collect($response->json('completed_today'))->pluck('id')->all())->toBe([
        $doneSecond->id,
        $doneFirst->id,
    ]);
});

it('handles local-midnight boundary across timezones (task due tomorrow in UTC lands in today in Asia/Ho_Chi_Minh)', function () {
    // 2026-10-23T18:00:00Z = 2026-10-24 01:00:00 +07:00
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T18:00:00Z'));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');

    $user = User::factory()->create();

    // Due 2026-10-24: In UTC this is "tomorrow", but in Ho Chi Minh today is 2026-10-24!
    $task = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Boundary task',
        'due_date' => '2026-10-24',
        'done' => false,
    ]);

    // Due 2026-10-23: In UTC this is today, but in Ho Chi Minh this is now yesterday (overdue)!
    $overdueTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Yesterday task',
        'due_date' => '2026-10-23',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/tasks?view=inbox')->assertStatus(200);

    expect(collect($response->json('today'))->pluck('id')->all())->toBe([$task->id]);
    expect(collect($response->json('overdue'))->pluck('id')->all())->toBe([$overdueTask->id]);
});
