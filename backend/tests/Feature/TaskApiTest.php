<?php

declare(strict_types=1);

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

function assertTaskSchema(mixed $body): void
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

it('creates a task with only id and title', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Buy milk',
    ])->assertStatus(201);

    $response->assertJson([
        'id' => $id,
        'title' => 'Buy milk',
        'due_date' => null,
        'start_time' => null,
        'end_time' => null,
        'priority' => null,
        'project_id' => null,
        'repeat' => 'never',
        'reminder' => 'none',
        'notes' => null,
        'done' => false,
        'done_at' => null,
        'created_by' => 'user',
        'source_note_id' => null,
    ]);

    assertTaskSchema($response->json());
});

it('a replay of the same id returns 200 with the stored task and still one row', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'First submission',
    ])->assertStatus(201);

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Modified submission',
    ])->assertStatus(200);

    expect($response->json('id'))->toBe($id)
        ->and($response->json('title'))->toBe('First submission')
        ->and(Task::count())->toBe(1);

    assertTaskSchema($response->json());
});

it('the same id used by another user returns 422 on id, and the other user\'s row is unchanged', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $id = (string) Str::uuid();

    $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'User original title',
    ])->assertStatus(201);

    $response = $this->actingAs($otherUser)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Hacker title',
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('error.invalid')
        ->and($response->json('error.fields.id'))->toContain('The id has already been taken.');

    $task = Task::withoutGlobalScope('owner')->find($id);
    expect($task)->not->toBeNull()
        ->and($task->user_id)->toBe($user->id)
        ->and($task->title)->toBe('User original title');
});

it('all fields: due 2026-10-26, 09:00–10:00, high, reminder 1d, notes, own project → 201; DB remind_at is 2026-10-25 02:00:00 UTC', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Work',
        'colour' => 'blue',
    ]);
    $id = (string) Str::uuid();

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Project presentation',
        'due_date' => '2026-10-26',
        'start_time' => '09:00',
        'end_time' => '10:00',
        'priority' => 'high',
        'reminder' => '1d',
        'notes' => 'Bring slides',
        'project_id' => $project->id,
    ])->assertStatus(201);

    assertTaskSchema($response->json());

    $task = DB::table('tasks')->find($id);
    expect($task)->not->toBeNull();
    $remindAt = (new DateTimeImmutable($task->remind_at))->format('Y-m-d H:i:s');
    expect($remindAt)->toBe('2026-10-25 02:00:00');
});

it('start_time without due_date → due_date becomes 2026-10-23 (today in Ho Chi Minh); repeat weekly without due_date → same', function () {
    $user = User::factory()->create();

    $id1 = (string) Str::uuid();
    $response1 = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id1,
        'title' => 'Task with start time only',
        'start_time' => '14:00',
    ])->assertStatus(201);

    expect($response1->json('due_date'))->toBe('2026-10-23');
    assertTaskSchema($response1->json());

    $id2 = (string) Str::uuid();
    $response2 = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id2,
        'title' => 'Task with weekly repeat only',
        'repeat' => 'weekly',
    ])->assertStatus(201);

    expect($response2->json('due_date'))->toBe('2026-10-23');
    assertTaskSchema($response2->json());
});

it('T-TK-21: end 09:00 with start 10:00 → 422 error.invalid, fields.end_time = End time must be later than the start time., no row created', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Invalid schedule',
        'start_time' => '10:00',
        'end_time' => '09:00',
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('error.invalid')
        ->and($response->json('error.fields.end_time'))->toContain('End time must be later than the start time.')
        ->and(Task::where('id', $id)->exists())->toBeFalse();
});

it('reminder without due_date → 422 on reminder; blank title ("   ") → 422; priority urgent → 422', function () {
    $user = User::factory()->create();

    // Reminder without due date
    $responseReminder = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => (string) Str::uuid(),
        'title' => 'Reminder without date',
        'reminder' => '15m',
    ])->assertStatus(422);

    expect($responseReminder->json('error.code'))->toBe('error.invalid')
        ->and($responseReminder->json('error.fields.reminder'))->toContain('Add a date to set a reminder.');

    // Blank title
    $responseTitle = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => (string) Str::uuid(),
        'title' => '   ',
    ])->assertStatus(422);

    expect($responseTitle->json('error.code'))->toBe('error.invalid')
        ->and($responseTitle->json('error.fields'))->toHaveKey('title');

    // Priority urgent
    $responsePriority = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => (string) Str::uuid(),
        'title' => 'Urgent priority',
        'priority' => 'urgent',
    ])->assertStatus(422);

    expect($responsePriority->json('error.code'))->toBe('error.invalid')
        ->and($responsePriority->json('error.fields'))->toHaveKey('priority');
});

it('someone else\'s project_id → 404 and no row', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $otherProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'name' => 'Secret project',
        'colour' => 'red',
    ]);
    $id = (string) Str::uuid();

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Intruder task',
        'project_id' => $otherProject->id,
    ])->assertStatus(404);

    expect($response->json('error.code'))->toBe('error.not_found')
        ->and(Task::where('id', $id)->exists())->toBeFalse();
});

it('5000 open tasks (bulk insert with DB::table, done=false) → 422 on task; with 5000 done tasks a new one is accepted', function () {
    $user = User::factory()->create();

    $records = [];
    for ($i = 0; $i < 5000; $i++) {
        $records[] = [
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'title' => "Task {$i}",
            'done' => false,
        ];
    }
    foreach (array_chunk($records, 1000) as $chunk) {
        DB::table('tasks')->insert($chunk);
    }

    $id = (string) Str::uuid();
    $responseOverLimit = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Task 5001',
    ])->assertStatus(422);

    expect($responseOverLimit->json('error.code'))->toBe('error.invalid')
        ->and($responseOverLimit->json('error.fields.task'))->toContain("You've reached 5,000 open tasks. Complete or delete some to add more.")
        ->and(Task::where('id', $id)->exists())->toBeFalse();

    // Mark all existing tasks as done
    DB::table('tasks')->where('user_id', $user->id)->update(['done' => true]);

    $responseAccepted = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Task 5001 now allowed',
    ])->assertStatus(201);

    expect(Task::where('id', $id)->exists())->toBeTrue();
    assertTaskSchema($responseAccepted->json());
});

it('GET own task → 200 schema-valid; GET another user\'s task → 404 error.not_found', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'My private task',
    ]);

    $responseOwner = $this->actingAs($user)->getJson("/api/v1/tasks/{$taskId}")
        ->assertStatus(200);

    expect($responseOwner->json('id'))->toBe($taskId)
        ->and($responseOwner->json('title'))->toBe('My private task');
    assertTaskSchema($responseOwner->json());

    $responseOther = $this->actingAs($otherUser)->getJson("/api/v1/tasks/{$taskId}")
        ->assertStatus(404);

    expect($responseOther->json('error.code'))->toBe('error.not_found');
});

it('rejects end_time without start_time', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Only end time',
        'end_time' => '10:00',
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('error.invalid')
        ->and($response->json('error.fields'))->toHaveKey('end_time')
        ->and(Task::where('id', $id)->exists())->toBeFalse();
});

it('replays a soft-deleted task with 200', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $task = Task::forceCreate([
        'id' => $id,
        'user_id' => $user->id,
        'title' => 'Deleted task',
        'deleted_at' => Carbon::now(),
    ]);

    $response = $this->actingAs($user)->postJson('/api/v1/tasks', [
        'id' => $id,
        'title' => 'Replay deleted',
    ])->assertStatus(200);

    expect($response->json('id'))->toBe($id)
        ->and($response->json('title'))->toBe('Deleted task');
    assertTaskSchema($response->json());
});

it('T-TK-11: patches each patchable field and updates its field_updated_at timestamp', function (
    string $field,
    mixed $initialValue,
    mixed $patchValue,
    mixed $expectedStoredValue,
    bool $needsProject = false,
    array $setup = [],
) {
    $user = User::factory()->create();
    $project = null;
    if ($needsProject) {
        $project = Project::forceCreate([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => 'Test Project',
            'colour' => 'blue',
        ]);
    }

    $actualField = $field === 'project_id null' || $field === 'project_id own project'
        ? 'project_id'
        : ($field === 'end_time with a start' ? 'end_time' : ($field === 'reminder with a due date' ? 'reminder' : $field));

    $taskId = (string) Str::uuid();
    $taskAttrs = [
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Initial title',
        'field_updated_at' => [
            $actualField => '2026-10-23T01:12:00Z',
        ],
    ];

    if ($needsProject && $field === 'project_id null') {
        $taskAttrs['project_id'] = $project->id;
    }

    foreach ($setup as $k => $v) {
        $taskAttrs[$k] = $v;
    }

    if ($initialValue !== null && $field !== 'project_id null') {
        $taskAttrs[$actualField] = $initialValue;
    }

    Task::forceCreate($taskAttrs);

    $resolvedPatchValue = is_callable($patchValue) ? $patchValue($project) : $patchValue;
    $resolvedExpectedValue = is_callable($expectedStoredValue) ? $expectedStoredValue($project) : $expectedStoredValue;

    $at = '2026-10-23T01:15:00Z';
    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        $actualField => $resolvedPatchValue,
        'at' => $at,
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task)->not->toBeNull();

    $storedVal = $task->{$actualField};
    if ($storedVal !== null && ($actualField === 'start_time' || $actualField === 'end_time')) {
        $storedVal = substr((string) $storedVal, 0, 5);
    }
    if ($storedVal !== null && $actualField === 'due_date') {
        $storedVal = substr((string) $storedVal, 0, 10);
    }

    expect($storedVal)->toBe($resolvedExpectedValue)
        ->and($task->field_updated_at[$actualField])->toBe($at);
})->with([
    'title' => ['title', 'Initial title', 'Updated title', 'Updated title', false, []],
    'due_date' => ['due_date', null, '2026-11-01', '2026-11-01', false, []],
    'start_time' => ['start_time', null, '10:00', '10:00', false, ['due_date' => '2026-11-01']],
    'end_time with a start' => ['end_time with a start', null, '11:00', '11:00', false, ['due_date' => '2026-11-01', 'start_time' => '10:00']],
    'priority' => ['priority', null, 'high', 'high', false, []],
    'reminder with a due date' => ['reminder with a due date', 'none', '15m', '15m', false, ['due_date' => '2026-11-01']],
    'repeat' => ['repeat', 'never', 'weekly', 'weekly', false, ['due_date' => '2026-11-01']],
    'notes' => ['notes', null, 'Some new notes', 'Some new notes', false, []],
    'project_id own project' => [
        'project_id own project',
        null,
        fn ($p) => $p->id,
        fn ($p) => $p->id,
        true,
        [],
    ],
    'project_id null' => [
        'project_id null',
        null,
        null,
        null,
        true,
        [],
    ],
]);

it('stale write: PATCH title with at=T2, then title with at=T1 (older) → second one ignored, title stays T2 value; response is still 200', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Original title',
        'field_updated_at' => [
            'title' => '2026-10-23T01:12:00Z',
        ],
    ]);

    $t2 = '2026-10-23T01:16:00Z';
    $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Title T2',
        'at' => $t2,
    ])->assertStatus(200);

    $task = Task::find($taskId);
    expect($task->title)->toBe('Title T2')
        ->and($task->field_updated_at['title'])->toBe($t2);

    $t1 = '2026-10-23T01:14:00Z';
    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Title T1',
        'at' => $t1,
    ])->assertStatus(200);

    expect($response->json('title'))->toBe('Title T2');
    assertTaskSchema($response->json());

    $task->refresh();
    expect($task->title)->toBe('Title T2')
        ->and($task->field_updated_at['title'])->toBe($t2);
});

it('future at (now + 1 day) → stored timestamp is now + 5 minutes', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Original title',
    ]);

    $futureAt = '2026-10-24T01:12:00Z';
    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Future title',
        'at' => $futureAt,
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->field_updated_at['title'])->toBe('2026-10-23T01:17:00Z');
});

it('missing at → uses the pinned clock now', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Original title',
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Missing at title',
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->field_updated_at['title'])->toBe('2026-10-23T01:12:00Z');
});

it('unknown keys user_id, created_by, done → 422 with the message, nothing changed', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Untouched task',
        'created_by' => 'user',
        'done' => false,
    ]);

    // user_id
    $respUserId = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'user_id' => 999,
    ])->assertStatus(422);
    expect($respUserId->json('error.code'))->toBe('error.invalid')
        ->and($respUserId->json('error.fields.user_id'))->toContain("This field can't be changed.");

    // created_by
    $respCreatedBy = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'created_by' => 'assistant',
    ])->assertStatus(422);
    expect($respCreatedBy->json('error.code'))->toBe('error.invalid')
        ->and($respCreatedBy->json('error.fields.created_by'))->toContain("This field can't be changed.");

    // done
    $respDone = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'done' => true,
    ])->assertStatus(422);
    expect($respDone->json('error.code'))->toBe('error.invalid')
        ->and($respDone->json('error.fields.done'))->toContain("This field can't be changed.");

    // id
    $respId = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'id' => (string) Str::uuid(),
    ])->assertStatus(422);
    expect($respId->json('error.code'))->toBe('error.invalid')
        ->and($respId->json('error.fields.id'))->toContain("This field can't be changed.");

    $task = Task::find($taskId);
    expect($task->title)->toBe('Untouched task')
        ->and($task->user_id)->toBe($user->id)
        ->and($task->created_by)->toBe('user')
        ->and($task->done)->toBeFalse();
});

it('merged validation: task 10:00–11:00, PATCH end_time 09:00 → 422 end_before_start; PATCH reminder 1h on a task with no due date → 422', function () {
    $user = User::factory()->create();

    // 1. end_before_start
    $task1Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $task1Id,
        'user_id' => $user->id,
        'title' => 'Scheduled task',
        'due_date' => '2026-10-25',
        'start_time' => '10:00',
        'end_time' => '11:00',
    ]);

    $response1 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$task1Id}", [
        'end_time' => '09:00',
    ])->assertStatus(422);

    expect($response1->json('error.code'))->toBe('error.invalid')
        ->and($response1->json('error.fields.end_time'))->toContain('End time must be later than the start time.');

    $task1 = Task::find($task1Id);
    expect(substr((string) $task1->end_time, 0, 5))->toBe('11:00');

    // 2. reminder on task with no due date
    $task2Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $task2Id,
        'user_id' => $user->id,
        'title' => 'Undated task',
        'due_date' => null,
    ]);

    $response2 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$task2Id}", [
        'reminder' => '1h',
    ])->assertStatus(422);

    expect($response2->json('error.code'))->toBe('error.invalid')
        ->and($response2->json('error.fields.reminder'))->toContain('Add a date to set a reminder.');

    $task2 = Task::find($task2Id);
    expect($task2->reminder)->toBe('none');
});

it('clearing due_date clears start, end, reminder and remind_at; clearing start_time clears end_time', function () {
    $user = User::factory()->create();

    // 1. Clearing due_date
    $task1Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $task1Id,
        'user_id' => $user->id,
        'title' => 'Full task',
        'due_date' => '2026-10-26',
        'start_time' => '10:00',
        'end_time' => '11:00',
        'reminder' => '1h',
        'remind_at' => Carbon::parse('2026-10-26 02:00:00'),
    ]);

    $response1 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$task1Id}", [
        'due_date' => null,
    ])->assertStatus(200);

    assertTaskSchema($response1->json());

    $task1 = Task::find($task1Id);
    expect($task1->due_date)->toBeNull()
        ->and($task1->start_time)->toBeNull()
        ->and($task1->end_time)->toBeNull()
        ->and($task1->reminder)->toBe('none')
        ->and($task1->remind_at)->toBeNull();

    // 2. Clearing start_time
    $task2Id = (string) Str::uuid();
    Task::forceCreate([
        'id' => $task2Id,
        'user_id' => $user->id,
        'title' => 'Timed task',
        'due_date' => '2026-10-26',
        'start_time' => '10:00',
        'end_time' => '11:00',
    ]);

    $response2 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$task2Id}", [
        'start_time' => null,
    ])->assertStatus(200);

    assertTaskSchema($response2->json());

    $task2 = Task::find($task2Id);
    expect($task2->start_time)->toBeNull()
        ->and($task2->end_time)->toBeNull();
});

it('setting start_time on an undated task sets due_date to today (2026-10-23 in Ho Chi Minh)', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Undated task',
        'due_date' => null,
        'start_time' => null,
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'start_time' => '14:00',
    ])->assertStatus(200);

    expect($response->json('due_date'))->toBe('2026-10-23');
    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect(substr((string) $task->due_date, 0, 10))->toBe('2026-10-23')
        ->and(substr((string) $task->start_time, 0, 5))->toBe('14:00');
});

it('remind_at recomputed: task due 2026-10-26 with reminder 1h, PATCH start_time 16:00 → remind_at 2026-10-26 08:00:00 UTC', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Meeting',
        'due_date' => '2026-10-26',
        'reminder' => '1h',
        'start_time' => null,
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'start_time' => '16:00',
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = DB::table('tasks')->find($taskId);
    expect($task)->not->toBeNull();
    $remindAt = (new DateTimeImmutable($task->remind_at))->format('Y-m-d H:i:s');
    expect($remindAt)->toBe('2026-10-26 08:00:00');
});

it('someone else\'s project_id → 404; someone else\'s task → 404; a soft-deleted task → 404', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $otherProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'name' => 'Secret project',
        'colour' => 'red',
    ]);

    $myTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'My task',
    ]);

    // 1. Someone else's project_id
    $respProj = $this->actingAs($user)->patchJson("/api/v1/tasks/{$myTask->id}", [
        'project_id' => $otherProject->id,
    ])->assertStatus(404);
    expect($respProj->json('error.code'))->toBe('error.not_found');

    // 2. Someone else's task
    $otherTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'title' => 'Other user task',
    ]);

    $respTask = $this->actingAs($user)->patchJson("/api/v1/tasks/{$otherTask->id}", [
        'title' => 'Hacked title',
    ])->assertStatus(404);
    expect($respTask->json('error.code'))->toBe('error.not_found');

    // 3. Soft-deleted task
    $deletedTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Deleted task',
        'deleted_at' => Carbon::now(),
    ]);

    $respDel = $this->actingAs($user)->patchJson("/api/v1/tasks/{$deletedTask->id}", [
        'title' => 'Revive attempt',
    ])->assertStatus(404);
    expect($respDel->json('error.code'))->toBe('error.not_found');
});

it('handles repeat anchor transitions correctly', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Recurring check',
        'due_date' => '2026-10-25',
        'repeat' => 'never',
        'repeat_anchor' => null,
    ]);

    // 1. Repeat changes from never → repeat_anchor = due_date
    $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'repeat' => 'weekly',
        'at' => '2026-10-23T01:13:00Z',
    ])->assertStatus(200);

    $task = Task::find($taskId);
    expect($task->repeat)->toBe('weekly')
        ->and(substr((string) $task->repeat_anchor, 0, 10))->toBe('2026-10-25');

    // 2. due_date changes while repeating → keep the anchor
    $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'due_date' => '2026-11-01',
        'at' => '2026-10-23T01:14:00Z',
    ])->assertStatus(200);

    $task->refresh();
    expect(substr((string) $task->due_date, 0, 10))->toBe('2026-11-01')
        ->and(substr((string) $task->repeat_anchor, 0, 10))->toBe('2026-10-25');

    // 3. repeat becomes never → repeat_anchor = null
    $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'repeat' => 'never',
        'at' => '2026-10-23T01:15:00Z',
    ])->assertStatus(200);

    $task->refresh();
    expect($task->repeat)->toBe('never')
        ->and($task->repeat_anchor)->toBeNull();
});

it('TK-E16: same title as before (after trim) is not counted as changed', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();
    $initialAt = '2026-10-23T01:12:00Z';

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Buy groceries',
        'field_updated_at' => [
            'title' => $initialAt,
        ],
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => '  Buy groceries  ',
        'at' => '2026-10-23T01:25:00Z',
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->title)->toBe('Buy groceries')
        ->and($task->field_updated_at['title'])->toBe($initialAt);
});

it('rejects invalid at format with 422', function (string $invalidAt) {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Test task',
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'at' => $invalidAt,
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('error.invalid')
        ->and($response->json('error.fields'))->toHaveKey('at');
})->with([
    'not a date' => 'invalid-at',
    'date without time' => '2026-10-23',
    'date without offset' => '2026-10-23T08:12:00',
    'invalid month' => '2026-13-01T08:12:00Z',
]);

it('PATCH with object form at: title at T2 applied, notes at T1 skipped when stored notes is T1.5', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    $t0 = '2026-10-23T01:10:00Z';
    $t1 = '2026-10-23T01:11:00Z';
    $t1_5 = '2026-10-23T01:11:30Z';
    $t2 = '2026-10-23T01:12:00Z';

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Initial title',
        'notes' => 'Initial notes',
        'field_updated_at' => [
            'title' => $t0,
            'notes' => $t1_5,
        ],
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Updated title',
        'notes' => 'Stale notes update',
        'at' => [
            'title' => $t2,
            'notes' => $t1,
        ],
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->title)->toBe('Updated title')
        ->and($task->notes)->toBe('Initial notes')
        ->and($task->field_updated_at['title'])->toBe($t2)
        ->and($task->field_updated_at['notes'])->toBe($t1_5);
});

it('PATCH with object form at: field missing from at uses pinned now', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    $pinnedNow = '2026-10-23T01:12:00Z';
    $t0 = '2026-10-23T01:10:00Z';
    $tTitle = '2026-10-23T01:15:00Z';

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Initial title',
        'notes' => 'Initial notes',
        'field_updated_at' => [
            'title' => $t0,
            'notes' => $t0,
        ],
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Updated title',
        'notes' => 'Updated notes',
        'at' => [
            'title' => $tTitle,
        ],
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->title)->toBe('Updated title')
        ->and($task->notes)->toBe('Updated notes')
        ->and($task->field_updated_at['title'])->toBe($tTitle)
        ->and($task->field_updated_at['notes'])->toBe($pinnedNow);
});

it('PATCH rejects invalid object at keys and formats with 422 and nothing saved', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();
    $t0 = '2026-10-23T01:10:00Z';

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Initial title',
        'notes' => 'Initial notes',
        'field_updated_at' => [
            'title' => $t0,
            'notes' => $t0,
        ],
    ]);

    // 1. at: {"user_id": "..."} → 422 on at.user_id
    $resp1 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Attempt 1',
        'at' => [
            'user_id' => '2026-10-23T01:12:00Z',
        ],
    ])->assertStatus(422);

    expect($resp1->json('error.code'))->toBe('error.invalid')
        ->and($resp1->json('error.fields'))->toHaveKey('at.user_id')
        ->and($resp1->json('error.fields')['at.user_id'])->toContain("This field can't be changed.");

    // 2. at: {"notes": "..."} without notes in body → 422 on at.notes
    $resp2 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Attempt 2',
        'at' => [
            'notes' => '2026-10-23T01:12:00Z',
        ],
    ])->assertStatus(422);

    expect($resp2->json('error.code'))->toBe('error.invalid')
        ->and($resp2->json('error.fields'))->toHaveKey('at.notes')
        ->and($resp2->json('error.fields')['at.notes'])->toContain('There is no change for this field.');

    // 3. at: {"title": "yesterday"} → 422 on at.title
    $resp3 = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'title' => 'Attempt 3',
        'at' => [
            'title' => 'yesterday',
        ],
    ])->assertStatus(422);

    expect($resp3->json('error.code'))->toBe('error.invalid')
        ->and($resp3->json('error.fields'))->toHaveKey('at.title')
        ->and($resp3->json('error.fields')['at.title'])->toContain('The at field must be a valid ISO 8601 date-time.');

    // Nothing saved in each case
    $task = Task::find($taskId);
    expect($task->title)->toBe('Initial title')
        ->and($task->notes)->toBe('Initial notes');
});

it('clearing due_date with object at sets start_time, end_time, reminder field_updated_at to due_date time', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();
    $t0 = '2026-10-23T01:10:00Z';
    $tClear = '2026-10-23T01:14:00Z';

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Dated task',
        'due_date' => '2026-10-26',
        'start_time' => '09:00',
        'end_time' => '10:00',
        'reminder' => '15m',
        'field_updated_at' => [
            'title' => $t0,
            'due_date' => $t0,
            'start_time' => $t0,
            'end_time' => $t0,
            'reminder' => $t0,
        ],
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/tasks/{$taskId}", [
        'due_date' => null,
        'at' => [
            'due_date' => $tClear,
        ],
    ])->assertStatus(200);

    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->due_date)->toBeNull()
        ->and($task->start_time)->toBeNull()
        ->and($task->end_time)->toBeNull()
        ->and($task->reminder)->toBe('none')
        ->and($task->field_updated_at['due_date'])->toBe($tClear)
        ->and($task->field_updated_at['start_time'])->toBe($tClear)
        ->and($task->field_updated_at['end_time'])->toBe($tClear)
        ->and($task->field_updated_at['reminder'])->toBe($tClear);
});
