<?php

declare(strict_types=1);

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
});

it('complete → 200, task.done true, done_at equals the pinned now (or the at sent), DB updated, body\'s task valid against task.schema.json', function () {
    $user = User::factory()->create();

    // 1. Missing at uses pinned now
    $taskId1 = (string) Str::uuid();
    Task::forceCreate([
        'id' => $taskId1,
        'user_id' => $user->id,
        'title' => 'Complete me with default now',
        'done' => false,
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $response1 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId1}/complete")
        ->assertStatus(200);

    $response1->assertJson([
        'task' => [
            'id' => $taskId1,
            'done' => true,
        ],
    ]);
    expect($response1->json('task.done_at'))->toStartWith('2026-10-23T01:12:00');
    assertTaskSchema($response1->json('task'));

    $dbTask1 = DB::table('tasks')->find($taskId1);
    expect($dbTask1)->not->toBeNull()
        ->and((bool) $dbTask1->done)->toBeTrue()
        ->and((new DateTimeImmutable($dbTask1->done_at))->format('Y-m-d H:i:s'))->toBe('2026-10-23 01:12:00');

    // 2. Explicit at sent
    $taskId2 = (string) Str::uuid();
    Task::forceCreate([
        'id' => $taskId2,
        'user_id' => $user->id,
        'title' => 'Complete me with explicit at',
        'done' => false,
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $explicitAt = '2026-10-23T01:14:00Z';
    $response2 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId2}/complete", [
        'at' => $explicitAt,
    ])->assertStatus(200);

    $response2->assertJson([
        'task' => [
            'id' => $taskId2,
            'done' => true,
        ],
    ]);
    expect($response2->json('task.done_at'))->toStartWith('2026-10-23T01:14:00');
    assertTaskSchema($response2->json('task'));

    $dbTask2 = DB::table('tasks')->find($taskId2);
    expect($dbTask2)->not->toBeNull()
        ->and((bool) $dbTask2->done)->toBeTrue()
        ->and((new DateTimeImmutable($dbTask2->done_at))->format('Y-m-d H:i:s'))->toBe('2026-10-23 01:14:00');
});

it('complete twice → second call leaves done_at unchanged', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Complete twice task',
        'done' => false,
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $t1 = '2026-10-23T01:13:00Z';
    $resp1 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete", ['at' => $t1])
        ->assertStatus(200);

    $firstDoneAt = $resp1->json('task.done_at');
    expect($firstDoneAt)->toStartWith('2026-10-23T01:13:00');

    $t2 = '2026-10-23T01:16:00Z';
    $resp2 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete", ['at' => $t2])
        ->assertStatus(200);

    expect($resp2->json('task.done_at'))->toBe($firstDoneAt);

    $task = Task::find($taskId);
    expect($task->field_updated_at['done'])->toBe(ms($t1));
});

it('stale complete: reopen with at=T2, then complete with at=T1 (older) → task stays open', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Stale complete task',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23 01:10:00'),
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $t2 = '2026-10-23T01:16:00Z';
    $reopenResp = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/reopen", ['at' => $t2])
        ->assertStatus(200);

    expect($reopenResp->json('task.done'))->toBeFalse()
        ->and($reopenResp->json('task.done_at'))->toBeNull();

    $t1 = '2026-10-23T01:14:00Z';
    $completeResp = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete", ['at' => $t1])
        ->assertStatus(200);

    expect($completeResp->json('task.done'))->toBeFalse()
        ->and($completeResp->json('task.done_at'))->toBeNull();

    $task = Task::find($taskId);
    expect($task->done)->toBeFalse()
        ->and($task->done_at)->toBeNull()
        ->and($task->field_updated_at['done'])->toBe(ms($t2));
});

it('reopen → done false, done_at null', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Reopen me',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23 01:10:00'),
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/reopen")
        ->assertStatus(200);

    $response->assertJson([
        'task' => [
            'id' => $taskId,
            'done' => false,
            'done_at' => null,
        ],
    ]);
    assertTaskSchema($response->json('task'));

    $task = Task::find($taskId);
    expect($task->done)->toBeFalse()
        ->and($task->done_at)->toBeNull()
        ->and($task->field_updated_at['done'])->toBe('2026-10-23T01:12:00.000Z');
});

it('T-TK-41 (API part of delete + Undo): DELETE → 204, GET → 404, row still in DB with deleted_at set; POST restore → 200, GET → 200 again', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Delete and undo me',
        'repeat' => 'never',
    ]);

    // 1. DELETE → 204
    $delResp = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}")
        ->assertStatus(204);
    expect($delResp->getContent())->toBeEmpty();

    // 2. GET → 404
    $getResp = $this->actingAs($user)->getJson("/api/v1/tasks/{$taskId}")
        ->assertStatus(404);
    expect($getResp->json('error.code'))->toBe('error.not_found');

    // 3. Row still in DB with deleted_at set, field_updated_at.deleted set to now
    $rawRow = DB::table('tasks')->find($taskId);
    expect($rawRow)->not->toBeNull()
        ->and($rawRow->deleted_at)->not->toBeNull();
    $rawFieldUpdatedAt = json_decode((string) $rawRow->field_updated_at, true);
    expect($rawFieldUpdatedAt['deleted'])->toBe('2026-10-23T01:12:00.000Z');

    // 4. POST restore → 200
    $restoreResp = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/restore")
        ->assertStatus(200);
    expect($restoreResp->json('id'))->toBe($taskId);
    assertTaskSchema($restoreResp->json());

    // 5. GET → 200 again
    $getAgainResp = $this->actingAs($user)->getJson("/api/v1/tasks/{$taskId}")
        ->assertStatus(200);
    expect($getAgainResp->json('id'))->toBe($taskId);
    assertTaskSchema($getAgainResp->json());

    $restoredTask = Task::find($taskId);
    expect($restoredTask)->not->toBeNull()
        ->and($restoredTask->deleted_at)->toBeNull()
        ->and($restoredTask->field_updated_at['deleted'])->toBe('2026-10-23T01:12:00.000Z');
});

it('DELETE a repeating task without scope or with scope=future → 422 on scope, task not deleted', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly team sync',
        'repeat' => 'weekly',
    ]);

    // 1. Without scope → 422 on scope, message: "Choose This task only or This and all future."
    $respWithoutScope = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}")
        ->assertStatus(422);

    expect($respWithoutScope->json('error.code'))->toBe('error.invalid')
        ->and($respWithoutScope->json('error.fields.scope'))->toContain('Choose This task only or This and all future.');

    // Task not deleted
    $task = Task::find($taskId);
    expect($task)->not->toBeNull()
        ->and($task->deleted_at)->toBeNull();

    // Invalid scope → 422
    $respInvalidScope = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=all")
        ->assertStatus(422);
    expect($respInvalidScope->json('error.fields.scope'))->toContain('Choose This task only or This and all future.');
});

it('DELETE repeating task with scope=one returns next with shifted dates and deletes the old row', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly sync',
        'start_date' => '2026-10-26',
        'due_date' => '2026-10-28',
        'repeat' => 'weekly',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(200);

    expect($response->json('next.start_date'))->toBe('2026-11-02')
        ->and($response->json('next.due_date'))->toBe('2026-11-04')
        ->and(Task::find($taskId))->toBeNull()
        ->and(Task::withTrashed()->find($taskId)->trashed())->toBeTrue();
    assertTaskSchema($response->json('next'));
});

it('DELETE repeating task with scope=future is 204 and no new row', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly sync',
        'start_date' => '2026-10-26',
        'due_date' => '2026-10-28',
        'repeat' => 'weekly',
        'done' => false,
    ]);

    $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=future")
        ->assertStatus(204);

    expect(Task::find($taskId))->toBeNull()
        ->and(Task::where('previous_occurrence_id', $taskId)->count())->toBe(0);
});

it('deleting one then restore removes the next and brings back the old', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly sync',
        'start_date' => '2026-10-26',
        'due_date' => '2026-10-28',
        'repeat' => 'weekly',
        'done' => false,
    ]);

    $resDelete = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(200);
    $nextId = $resDelete->json('next.id');
    expect(Task::find($nextId))->not->toBeNull()
        ->and(Task::find($taskId))->toBeNull();

    $resRestore = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/restore")
        ->assertStatus(200);

    expect($resRestore->json('id'))->toBe($taskId)
        ->and(Task::find($taskId))->not->toBeNull()
        ->and(Task::find($nextId))->toBeNull()
        ->and(Task::withTrashed()->find($nextId)->trashed())->toBeTrue();
});

it('delete one, restore, delete one again works (unique previous_occurrence_id)', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly sync',
        'start_date' => '2026-10-26',
        'due_date' => '2026-10-28',
        'repeat' => 'weekly',
        'done' => false,
    ]);

    $res1 = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(200);
    $nextId1 = $res1->json('next.id');

    $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/restore")
        ->assertStatus(200);

    $res2 = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(200);
    $nextId2 = $res2->json('next.id');

    expect($nextId2)->toBe($nextId1)
        ->and(Task::find($nextId2))->not->toBeNull()
        ->and(Task::find($taskId))->toBeNull();
});

it('done repeating task with one creates nothing', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly sync',
        'start_date' => '2026-10-26',
        'due_date' => '2026-10-28',
        'repeat' => 'weekly',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23 01:10:00'),
    ]);

    $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(204);

    expect(Task::find($taskId))->toBeNull()
        ->and(Task::where('previous_occurrence_id', $taskId)->count())->toBe(0);
});

it('a series whose rule ended returns 204', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Repeat until past',
        'start_date' => '2026-10-20',
        'due_date' => '2026-10-20',
        'repeat' => 'daily',
        'repeat_rule' => 'FREQ=DAILY;COUNT=1',
        'repeat_anchor' => '2026-10-20',
        'done' => false,
    ]);

    $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(204);

    expect(Task::find($taskId))->toBeNull()
        ->and(Task::where('previous_occurrence_id', $taskId)->count())->toBe(0);
});

it('restore of a task that is not deleted → 200, nothing changes', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Active task',
        'field_updated_at' => [
            'deleted' => '2026-10-23T01:00:00Z',
        ],
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/restore")
        ->assertStatus(200);

    expect($response->json('id'))->toBe($taskId);
    assertTaskSchema($response->json());

    $task = Task::find($taskId);
    expect($task->deleted_at)->toBeNull()
        ->and($task->field_updated_at['deleted'])->toBe('2026-10-23T01:00:00Z');
});

it('someone else\'s task → 404 on complete, reopen, delete and restore', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $otherActiveTaskId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $otherActiveTaskId,
        'user_id' => $otherUser->id,
        'title' => 'Other user active task',
    ]);

    $otherDeletedTaskId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $otherDeletedTaskId,
        'user_id' => $otherUser->id,
        'title' => 'Other user deleted task',
        'deleted_at' => Carbon::now(),
    ]);

    // complete
    $respComplete = $this->actingAs($user)->postJson("/api/v1/tasks/{$otherActiveTaskId}/complete")
        ->assertStatus(404);
    expect($respComplete->json('error.code'))->toBe('error.not_found');

    // reopen
    $respReopen = $this->actingAs($user)->postJson("/api/v1/tasks/{$otherActiveTaskId}/reopen")
        ->assertStatus(404);
    expect($respReopen->json('error.code'))->toBe('error.not_found');

    // delete
    $respDelete = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$otherActiveTaskId}")
        ->assertStatus(404);
    expect($respDelete->json('error.code'))->toBe('error.not_found');

    // restore on active task
    $respRestoreActive = $this->actingAs($user)->postJson("/api/v1/tasks/{$otherActiveTaskId}/restore")
        ->assertStatus(404);
    expect($respRestoreActive->json('error.code'))->toBe('error.not_found');

    // restore on deleted task
    $respRestoreDeleted = $this->actingAs($user)->postJson("/api/v1/tasks/{$otherDeletedTaskId}/restore")
        ->assertStatus(404);
    expect($respRestoreDeleted->json('error.code'))->toBe('error.not_found');
});

it('a future at on complete is clamped to now + 5 minutes', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Future clamp task',
        'done' => false,
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $futureAt = '2026-10-24T01:12:00Z'; // 1 day in the future
    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete", [
        'at' => $futureAt,
    ])->assertStatus(200);

    expect($response->json('task.done_at'))->toStartWith('2026-10-23T01:17:00');
    assertTaskSchema($response->json('task'));

    $task = Task::find($taskId);
    expect($task->field_updated_at['done'])->toBe('2026-10-23T01:17:00.000Z');
});

it('rejects invalid at format on complete and reopen with 422', function (string $invalidAt) {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Test invalid at',
        'done' => false,
    ]);

    $respComplete = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete", [
        'at' => $invalidAt,
    ])->assertStatus(422);

    expect($respComplete->json('error.code'))->toBe('error.invalid')
        ->and($respComplete->json('error.fields'))->toHaveKey('at');

    $respReopen = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/reopen", [
        'at' => $invalidAt,
    ])->assertStatus(422);

    expect($respReopen->json('error.code'))->toBe('error.invalid')
        ->and($respReopen->json('error.fields'))->toHaveKey('at');
})->with([
    'not a date' => 'invalid-at',
    'date without time' => '2026-10-23',
    'date without offset' => '2026-10-23T08:12:00',
    'invalid month' => '2026-13-01T08:12:00Z',
]);

it('DELETE repeating task with scope=one succeeds with 204', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Daily standup',
        'repeat' => 'daily',
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/tasks/{$taskId}?scope=one")
        ->assertStatus(204);
    expect($response->getContent())->toBeEmpty();

    $task = Task::find($taskId);
    expect($task)->toBeNull();
});

it('with 5000 open tasks, reopen a done task → 422 task.limit, task stays done; succeeds when under limit', function () {
    $user = User::factory()->create();

    $doneTaskId = (string) Str::uuid();
    $doneAt = '2026-10-23 01:10:00';
    Task::forceCreate([
        'id' => $doneTaskId,
        'user_id' => $user->id,
        'title' => 'Completed task to reopen',
        'done' => true,
        'done_at' => Carbon::parse($doneAt),
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

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

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$doneTaskId}/reopen")
        ->assertStatus(422);

    expect($response->json('error.code'))->toBe('task.limit')
        ->and($response->json('error.message'))->toBe("You've reached 5,000 open tasks. Complete or delete some to add more.")
        ->and($response->json('error.request_id'))->not->toBeEmpty();

    $taskAfter = Task::find($doneTaskId);
    expect($taskAfter)->not->toBeNull()
        ->and($taskAfter->done)->toBeTrue()
        ->and($taskAfter->done_at->format('Y-m-d H:i:s'))->toBe($doneAt);

    // Delete one open task so we are under 5000
    DB::table('tasks')->where('user_id', $user->id)->where('done', false)->limit(1)->delete();

    $successResponse = $this->actingAs($user)->postJson("/api/v1/tasks/{$doneTaskId}/reopen")
        ->assertStatus(200);

    expect($successResponse->json('task.done'))->toBeFalse()
        ->and($successResponse->json('task.done_at'))->toBeNull();
});

it('with 5000 open tasks, restore a deleted open task → 422 task.limit, task stays deleted; succeeds when under limit', function () {
    $user = User::factory()->create();

    $deletedTaskId = (string) Str::uuid();
    $deletedAt = '2026-10-23 01:10:00';
    Task::forceCreate([
        'id' => $deletedTaskId,
        'user_id' => $user->id,
        'title' => 'Deleted open task to restore',
        'done' => false,
        'deleted_at' => Carbon::parse($deletedAt),
        'field_updated_at' => [
            'deleted' => '2026-10-23T01:10:00Z',
        ],
    ]);

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

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$deletedTaskId}/restore")
        ->assertStatus(422);

    expect($response->json('error.code'))->toBe('task.limit')
        ->and($response->json('error.message'))->toBe("You've reached 5,000 open tasks. Complete or delete some to add more.")
        ->and($response->json('error.request_id'))->not->toBeEmpty();

    $rawRow = DB::table('tasks')->find($deletedTaskId);
    expect($rawRow)->not->toBeNull()
        ->and($rawRow->deleted_at)->not->toBeNull();

    // Delete one open task so we are under 5000
    DB::table('tasks')->where('user_id', $user->id)->whereNull('deleted_at')->where('done', false)->limit(1)->delete();

    $successResponse = $this->actingAs($user)->postJson("/api/v1/tasks/{$deletedTaskId}/restore")
        ->assertStatus(200);

    expect($successResponse->json('id'))->toBe($deletedTaskId);
    $restoredTask = Task::find($deletedTaskId);
    expect($restoredTask)->not->toBeNull()
        ->and($restoredTask->deleted_at)->toBeNull();
});

it('with 5000 open tasks, restoring a deleted done task succeeds because it is not open', function () {
    $user = User::factory()->create();

    $deletedDoneTaskId = (string) Str::uuid();
    Task::forceCreate([
        'id' => $deletedDoneTaskId,
        'user_id' => $user->id,
        'title' => 'Deleted completed task to restore',
        'done' => true,
        'done_at' => Carbon::parse('2026-10-23 01:00:00'),
        'deleted_at' => Carbon::parse('2026-10-23 01:10:00'),
        'field_updated_at' => [
            'deleted' => '2026-10-23T01:10:00Z',
        ],
    ]);

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

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$deletedDoneTaskId}/restore")
        ->assertStatus(200);

    expect($response->json('id'))->toBe($deletedDoneTaskId);
    $restoredTask = Task::find($deletedDoneTaskId);
    expect($restoredTask)->not->toBeNull()
        ->and($restoredTask->deleted_at)->toBeNull()
        ->and($restoredTask->done)->toBeTrue();
});

it('completing a weekly task with start and due dates shifts both together', function () {
    $user = User::factory()->create();
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly sprint review',
        'start_date' => '2026-10-26',
        'due_date' => '2026-10-28',
        'start_time' => '09:00',
        'due_time' => '17:00',
        'repeat' => 'weekly',
        'done' => false,
        'field_updated_at' => [
            'done' => '2026-10-23T01:10:00Z',
        ],
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete")
        ->assertStatus(200);

    expect($response->json('next.start_date'))->toBe('2026-11-02')
        ->and($response->json('next.due_date'))->toBe('2026-11-04')
        ->and($response->json('next.start_time'))->toBe('09:00')
        ->and($response->json('next.due_time'))->toBe('17:00');
    assertTaskSchema($response->json('task'));
    assertTaskSchema($response->json('next'));
});

it('T-TK-101 (TK-E1): monthly on the 31st: completing moves 31 Jan → 28 Feb → 31 Mar', function () {
    $clock = new FrozenClock('2026-01-31T10:00:00Z');
    app()->instance(ClockInterface::class, $clock);

    $user = User::factory()->create(['timezone' => 'UTC']);
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Monthly bill',
        'due_date' => '2026-01-31',
        'repeat' => 'monthly',
        'repeat_anchor' => '2026-01-31',
        'done' => false,
    ]);

    $res1 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete")
        ->assertStatus(200);
    expect($res1->json('next.due_date'))->toBe('2026-02-28');
    $nextId = $res1->json('next.id');

    $clock->setTime('2026-02-28T10:00:00Z');
    $res2 = $this->actingAs($user)->postJson("/api/v1/tasks/{$nextId}/complete")
        ->assertStatus(200);
    expect($res2->json('next.due_date'))->toBe('2026-03-31');
});

it('T-TK-102 (TK-E2): daily task completed 3 days late through /complete: next occurrence is today', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Daily workout',
        'due_date' => '2026-10-20',
        'repeat' => 'daily',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete")
        ->assertStatus(200);

    expect($response->json('next.due_date'))->toBe('2026-10-23');
});

it('T-TK-103 (TK-E3): weekly task completed early: next comes from the due date, not the completion date', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Weekly report',
        'due_date' => '2026-10-28',
        'repeat' => 'weekly',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete")
        ->assertStatus(200);

    expect($response->json('next.due_date'))->toBe('2026-11-04');
});

it('T-TK-106 (TK-E6): complete a repeating task then /reopen: the generated occurrence is gone', function () {
    $user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Repeating meeting',
        'due_date' => '2026-10-23',
        'repeat' => 'daily',
        'done' => false,
    ]);

    $completeResp = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete")
        ->assertStatus(200);
    $nextId = $completeResp->json('next.id');
    expect(Task::find($nextId))->not->toBeNull();

    /** @var FrozenClock $clock */
    $clock = app(ClockInterface::class);
    $clock->advance('+1 second');

    $reopenResp = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/reopen")
        ->assertStatus(200);

    expect($reopenResp->json('task.done'))->toBeFalse()
        ->and(Task::find($nextId))->toBeNull()
        ->and(Task::withTrashed()->find($nextId)->trashed())->toBeTrue();
});

it('T-TK-115 (TK-E15): yearly anchored on 29 Feb: 28 Feb in non-leap years, back to 29 Feb in a leap year', function () {
    $clock = new FrozenClock('2024-02-29T10:00:00Z');
    app()->instance(ClockInterface::class, $clock);

    $user = User::factory()->create(['timezone' => 'UTC']);
    $taskId = (string) Str::uuid();

    Task::forceCreate([
        'id' => $taskId,
        'user_id' => $user->id,
        'title' => 'Leap year checkup',
        'due_date' => '2024-02-29',
        'repeat' => 'yearly',
        'repeat_anchor' => '2024-02-29',
        'done' => false,
    ]);

    $res1 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId}/complete")
        ->assertStatus(200);
    expect($res1->json('next.due_date'))->toBe('2025-02-28');

    $clock->setTime('2027-02-28T10:00:00Z');
    $taskId2027 = (string) Str::uuid();
    Task::forceCreate([
        'id' => $taskId2027,
        'user_id' => $user->id,
        'title' => 'Leap year checkup 2027',
        'due_date' => '2027-02-28',
        'repeat' => 'yearly',
        'repeat_anchor' => '2024-02-29',
        'done' => false,
    ]);

    $res2 = $this->actingAs($user)->postJson("/api/v1/tasks/{$taskId2027}/complete")
        ->assertStatus(200);
    expect($res2->json('next.due_date'))->toBe('2028-02-29');
});
