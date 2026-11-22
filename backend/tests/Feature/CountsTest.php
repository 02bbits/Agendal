<?php

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use Tests\Support\FrozenClock;

// GET /counts (AP §7): the sidebar's numbers in one call, by the rules of the lists they stand for
uses(RefreshDatabase::class);

beforeEach(function () {
    $clock = new FrozenClock('2026-10-23T01:12:00Z');
    app()->instance(ClockInterface::class, $clock);
    $this->travelTo(Carbon::instance($clock->now()));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
    $this->actingAs(User::factory()->create());

    $task = fn (array $body) => $this->postJson('/api/v1/tasks', ['id' => (string) Str::uuid(), 'title' => 'Task', ...$body])->assertCreated();
    $project = (string) Str::uuid();
    $this->postJson('/api/v1/projects', ['id' => $project, 'name' => 'Home', 'colour' => 'blue'])->assertCreated();
    $task(['due_date' => '2026-10-22']);
    $task(['due_date' => '2026-10-23', 'project_id' => $project]);
    $task(['due_date' => '2026-10-25']);
    $task([]);
    $done = $task(['due_date' => '2026-10-26'])->json('id');
    $this->postJson("/api/v1/tasks/{$done}/complete")->assertOk();
    $this->postJson('/api/v1/notes', ['client_id' => (string) Str::uuid(), 'text' => 'call mum tomorrow', 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertCreated();
});

it('matches the lists each count stands for', function () {
    $counts = $this->getJson('/api/v1/counts')->assertOk()->json();
    $inbox = $this->getJson('/api/v1/tasks?view=inbox')->json();
    $none = $this->getJson('/api/v1/projects/none')->json('progress');

    expect($counts)->toBe([
        'inbox' => count($inbox['overdue']) + count($inbox['today']),
        'upcoming' => $this->getJson('/api/v1/tasks?view=upcoming')->json('total_count'),
        'no_project' => $none['total'] - $none['done'],
        'notes' => $this->getJson('/api/v1/notes')->json('total'),
    ])->and($counts['inbox'])->toBeGreaterThanOrEqual(2)
        ->and($counts['notes'])->toBe(1);
});

it('matches the shared schema', function () {
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', base_path('../docs/07-architecture/contracts/schemas/'));
    $result = $validator->validate(json_decode($this->getJson('/api/v1/counts')->getContent()), 'https://agendal.app/schemas/counts.schema.json');

    expect($result->isValid())->toBeTrue($result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error())));
});

it("never counts another user's rows", function () {
    $this->actingAs(User::factory()->create());

    expect($this->getJson('/api/v1/counts')->assertOk()->json())
        ->toBe(['inbox' => 0, 'upcoming' => 0, 'no_project' => 0, 'notes' => 0]);
});
