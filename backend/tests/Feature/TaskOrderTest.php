<?php

declare(strict_types=1);

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use Tests\Support\FrozenClock;

// #178: manual order for drag and drop. project_order and day_order are fractional-index keys:
// a move writes only the moved task's key (one field, last write wins like any other field).
uses(RefreshDatabase::class);

if (! function_exists('assertTaskSchema')) {
    function assertTaskSchema(mixed $body): void
    {
        $validator = new Validator;
        $validator->resolver()->registerPrefix('https://agendal.app/schemas/', __DIR__.'/../../../docs/07-architecture/contracts/schemas/');
        $result = $validator->validate(json_decode(json_encode($body)), 'https://agendal.app/schemas/task.schema.json');

        expect($result->isValid())->toBeTrue(
            $result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error()), JSON_PRETTY_PRINT)
        );
    }
}

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T01:12:00Z'));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

function orderedTask(array $attrs = []): Task
{
    return Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => test()->user->id,
        'title' => 'Ordered',
        ...$attrs,
    ]);
}

function patchTask(Task $task, array $body): TestResponse
{
    return test()->patchJson("/api/v1/tasks/{$task->id}", [...$body, 'at' => '2026-10-23T01:15:00Z']);
}

it('creates a task with its keys and returns them, schema-valid', function () {
    $id = (string) Str::uuid();
    $res = $this->postJson('/api/v1/tasks', ['id' => $id, 'title' => 'Placed', 'project_order' => 'a0', 'day_order' => 'a1'])
        ->assertCreated();

    expect($res->json('project_order'))->toBe('a0')
        ->and($res->json('day_order'))->toBe('a1');
    assertTaskSchema($res->json());
});

it('a task never placed by hand returns null keys', function () {
    $res = $this->getJson('/api/v1/tasks/'.orderedTask()->id)->assertOk();

    expect($res->json('project_order'))->toBeNull()
        ->and($res->json('day_order'))->toBeNull();
    assertTaskSchema($res->json());
});

it('a move writes only the moved task\'s key and stamps it', function () {
    $moved = orderedTask(['day_order' => 'a1']);
    $other = orderedTask(['day_order' => 'a2']);

    patchTask($moved, ['day_order' => 'a3'])->assertOk()->assertJsonPath('day_order', 'a3');

    expect($moved->fresh()->field_updated_at)->toHaveKey('day_order')
        ->and($other->fresh()->day_order)->toBe('a2');
});

it('rejects a key that is not base-62 or too long', function (string $field, string $key) {
    patchTask(orderedTask(), [$field => $key])->assertStatus(422)->assertJsonPath("error.fields.{$field}.0", fn ($m) => is_string($m));
})->with([
    'project_order with a space' => ['project_order', 'a 1'],
    'day_order with a dash' => ['day_order', 'a-1'],
    'day_order of 65 chars' => ['day_order', str_repeat('a', 65)],
]);

it('moving the task to another day without a new place drops its day_order', function (string $field) {
    $task = orderedTask(['start_date' => '2026-10-23', 'due_date' => '2026-10-25', 'day_order' => 'a1', 'project_order' => 'a5']);

    patchTask($task, [$field => '2026-10-24'])->assertOk()->assertJsonPath('day_order', null);

    expect($task->fresh()->project_order)->toBe('a5');
})->with(['start_date', 'due_date']);

it('a new day sent with a new place keeps that place', function () {
    $task = orderedTask(['due_date' => '2026-10-23', 'day_order' => 'a1']);

    patchTask($task, ['due_date' => '2026-10-24', 'day_order' => 'Zz'])->assertOk()->assertJsonPath('day_order', 'Zz');
});

it('moving the task to another project drops its project_order, and keeps its day_order', function () {
    $project = Project::forceCreate(['id' => (string) Str::uuid(), 'user_id' => $this->user->id, 'name' => 'Home', 'colour' => 'blue']);
    $task = orderedTask(['due_date' => '2026-10-23', 'project_order' => 'a1', 'day_order' => 'a2']);

    patchTask($task, ['project_id' => $project->id])->assertOk()
        ->assertJsonPath('project_order', null)
        ->assertJsonPath('day_order', 'a2');
});

it('an older key loses to a newer one (last write wins per field)', function () {
    $task = orderedTask(['day_order' => 'a1', 'field_updated_at' => ['day_order' => '2026-10-23T01:20:00.000Z']]);

    patchTask($task, ['day_order' => 'a9'])->assertOk()->assertJsonPath('day_order', 'a1');
});

it('syncs a key as one field row', function () {
    $task = orderedTask(['project_order' => 'a1']);

    $results = $this->postJson('/api/v1/sync/patches', [
        ['entity' => 'task', 'id' => $task->id, 'field' => 'project_order', 'value' => 'a0V', 'at' => '2026-10-23T01:15:00Z'],
    ])->assertOk()->json('results');

    expect($results)->toBe([['index' => 0, 'status' => 'applied']])
        ->and($task->fresh()->project_order)->toBe('a0V');
});

it('the next occurrence of a repeating task keeps its project place but not its day place', function () {
    $task = orderedTask(['due_date' => '2026-10-23', 'repeat' => 'daily', 'repeat_anchor' => '2026-10-23', 'project_order' => 'a3', 'day_order' => 'a4']);

    $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertOk();

    $next = Task::query()->where('id', '!=', $task->id)->where('title', 'Ordered')->firstOrFail();
    expect($next->project_order)->toBe('a3')
        ->and($next->day_order)->toBeNull();
});
