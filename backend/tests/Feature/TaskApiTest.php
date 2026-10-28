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
