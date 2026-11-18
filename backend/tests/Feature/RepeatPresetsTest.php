<?php

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

// #154: the Repeat presets and custom rules the app sends, and the next occurrence each makes
uses(RefreshDatabase::class);

beforeEach(function () {
    // Friday 23 Oct 2026, 08:12 in Ho Chi Minh
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T01:12:00Z'));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
    $this->actingAs(User::factory()->create());
});

it('saves a rule and completing the task starts the next one on the right date', function (string $start, string $repeat, string $rule, string $next) {
    $id = (string) Str::uuid();
    $this->postJson('/api/v1/tasks', [
        'id' => $id, 'title' => 'Series', 'start_date' => $start, 'repeat' => $repeat, 'repeat_rule' => $rule,
    ])->assertCreated()->assertJsonPath('repeat_rule', $rule)->assertJsonPath('start_date', $start);

    $created = $this->postJson("/api/v1/tasks/{$id}/complete")->assertOk()->json('next');

    expect($created)->not->toBeNull()
        ->and($created['start_date'])->toBe($next)
        ->and($created['repeat_rule'])->toBe($rule);
})->with([
    'every weekday, from a Friday' => ['2026-10-23', 'weekly', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', '2026-10-26'],
    'every week on Friday' => ['2026-10-23', 'weekly', 'FREQ=WEEKLY;BYDAY=FR', '2026-10-30'],
    'every 2 weeks on Friday' => ['2026-10-23', 'weekly', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR', '2026-11-06'],
    'every month on the 23rd' => ['2026-10-23', 'monthly', 'FREQ=MONTHLY;BYMONTHDAY=23', '2026-11-23'],
    'every month on the fourth Friday' => ['2026-10-23', 'monthly', 'FREQ=MONTHLY;BYDAY=4FR', '2026-11-27'],
    'every month on the last Friday' => ['2026-10-30', 'monthly', 'FREQ=MONTHLY;BYDAY=-1FR', '2026-11-27'],
    'every month on the third Monday' => ['2026-11-16', 'monthly', 'FREQ=MONTHLY;BYDAY=3MO', '2026-12-21'],
    'every year on 23 Oct' => ['2026-10-23', 'yearly', 'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=23', '2027-10-23'],
    'every 2 weeks on Mon and Wed' => ['2026-10-26', 'weekly', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', '2026-10-28'],
]);

it('stops a series at COUNT and at UNTIL', function (string $rule) {
    $id = (string) Str::uuid();
    $this->postJson('/api/v1/tasks', [
        'id' => $id, 'title' => 'Short series', 'start_date' => '2026-10-23', 'repeat' => 'daily', 'repeat_rule' => $rule,
    ])->assertCreated();

    $second = $this->postJson("/api/v1/tasks/{$id}/complete")->assertOk()->json('next');
    expect($second['start_date'])->toBe('2026-10-24');

    // The second occurrence is the last one
    expect($this->postJson("/api/v1/tasks/{$second['id']}/complete")->assertOk()->json('next'))->toBeNull();
})->with(['two times' => ['FREQ=DAILY;COUNT=2'], 'until 24 Oct' => ['FREQ=DAILY;UNTIL=20261024T235959Z']]);

it('starts a dateless repeating task today on the start date (#154)', function () {
    $id = (string) Str::uuid();
    $this->postJson('/api/v1/tasks', ['id' => $id, 'title' => 'Water plants', 'repeat' => 'daily'])->assertCreated();

    $this->patchJson("/api/v1/tasks/{$id}", ['repeat' => 'never'])->assertOk();
    $this->patchJson("/api/v1/tasks/{$id}", ['start_date' => null])->assertOk();

    $this->patchJson("/api/v1/tasks/{$id}", ['repeat' => 'weekly', 'repeat_rule' => 'FREQ=WEEKLY;BYDAY=FR'])
        ->assertOk()
        ->assertJsonPath('start_date', '2026-10-23')
        ->assertJsonPath('due_date', null);
});
