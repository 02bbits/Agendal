<?php

declare(strict_types=1);

use App\Http\Controllers\ProjectController;
use App\Models\Project;
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

function assertProjectSchema(mixed $body): void
{
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', __DIR__.'/../../../docs/07-architecture/contracts/schemas/');
    $result = $validator->validate(json_decode(json_encode($body)), 'https://agendal.app/schemas/project.schema.json');

    expect($result->isValid())->toBeTrue(
        $result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error()), JSON_PRETTY_PRINT)
    );
}

function assertProjectApiErrorShape(mixed $body): void
{
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', __DIR__.'/../../../docs/07-architecture/contracts/schemas/');
    $result = $validator->validate(json_decode(json_encode($body)), 'https://agendal.app/schemas/error.schema.json');

    expect($result->isValid())->toBeTrue(
        $result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error()), JSON_PRETTY_PRINT)
    );
}

function assertProjectTaskSchema(mixed $body): void
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

it('lists user non-deleted projects with open and done task counts ordered by lower(name)', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    // Two active projects for user, intentionally inserted out of order to verify lower(name) sorting
    $projectZeta = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Zeta Project',
        'colour' => 'blue',
    ]);
    $projectAlpha = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'alpha project',
        'colour' => 'green',
    ]);

    // Deleted project for user (should be hidden)
    $projectDeleted = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Archived Project',
        'colour' => 'red',
        'deleted_at' => Carbon::now(),
    ]);

    // Another user's project (should be hidden)
    $projectOther = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'name' => 'Other Project',
        'colour' => 'purple',
    ]);

    // Tasks for alpha project: 1 open, 1 done, 1 deleted
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $projectAlpha->id,
        'title' => 'Alpha Open Task',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $projectAlpha->id,
        'title' => 'Alpha Done Task',
        'done' => true,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $projectAlpha->id,
        'title' => 'Alpha Deleted Task',
        'done' => false,
        'deleted_at' => Carbon::now(),
    ]);

    // Tasks for Zeta project: 0 open, 1 done
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $projectZeta->id,
        'title' => 'Zeta Done Task',
        'done' => true,
    ]);

    // Task for deleted project
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $projectDeleted->id,
        'title' => 'Deleted Project Task',
        'done' => false,
    ]);

    // Task for other user
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'project_id' => $projectOther->id,
        'title' => 'Other User Task',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->getJson('/api/v1/projects')->assertStatus(200);

    $items = $response->json();
    expect($items)->toBeArray()->toHaveCount(2);

    // Alpha project comes first because lower('alpha project') < lower('Zeta Project')
    expect($items[0]['id'])->toBe($projectAlpha->id)
        ->and($items[0]['name'])->toBe('alpha project')
        ->and($items[0]['colour'])->toBe('green')
        ->and($items[0]['open'])->toBe(1)
        ->and($items[0]['done'])->toBe(1);

    expect($items[1]['id'])->toBe($projectZeta->id)
        ->and($items[1]['name'])->toBe('Zeta Project')
        ->and($items[1]['colour'])->toBe('blue')
        ->and($items[1]['open'])->toBe(0)
        ->and($items[1]['done'])->toBe(1);

    assertProjectSchema($items[0]);
    assertProjectSchema($items[1]);
});

it('creates a project with 201 and valid schema', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $response = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => $id,
        'name' => ' Work ',
        'colour' => 'blue',
    ])->assertStatus(201);

    $response->assertJson([
        'id' => $id,
        'name' => 'Work',
        'colour' => 'blue',
        'open' => 0,
        'done' => 0,
    ]);

    assertProjectSchema($response->json());
    expect(Project::where('id', $id)->count())->toBe(1);
});

it('replays with 200 without creating a second row', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => $id,
        'name' => 'Original',
        'colour' => 'teal',
    ])->assertStatus(201);

    $response = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => $id,
        'name' => 'Modified Name',
        'colour' => 'red',
    ])->assertStatus(200);

    expect($response->json('id'))->toBe($id)
        ->and($response->json('name'))->toBe('Original')
        ->and($response->json('colour'))->toBe('teal')
        ->and($response->json('open'))->toBe(0)
        ->and($response->json('done'))->toBe(0)
        ->and(Project::count())->toBe(1);

    assertProjectSchema($response->json());
});

it('replay returns 200 if the project was deleted', function () {
    $user = User::factory()->create();
    $id = (string) Str::uuid();

    Project::forceCreate([
        'id' => $id,
        'user_id' => $user->id,
        'name' => 'Deleted One',
        'colour' => 'gray',
        'deleted_at' => Carbon::now(),
    ]);

    $response = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => $id,
        'name' => 'Try recreate',
        'colour' => 'orange',
    ])->assertStatus(200);

    expect($response->json('id'))->toBe($id)
        ->and($response->json('name'))->toBe('Deleted One')
        ->and(Project::count())->toBe(1);

    assertProjectSchema($response->json());
});

it('rejects an id taken by another user with 404', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $id = (string) Str::uuid();

    $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => $id,
        'name' => 'First User Project',
        'colour' => 'blue',
    ])->assertStatus(201);

    $response = $this->actingAs($otherUser)->postJson('/api/v1/projects', [
        'id' => $id,
        'name' => 'Hacker Project',
        'colour' => 'green',
    ])->assertStatus(404);

    expect($response->json('error.code'))->toBe('error.not_found')
        ->and($response->json('error.message'))->toBe('This item no longer exists.')
        ->and($response->json('error.request_id'))->not->toBeEmpty();

    assertProjectApiErrorShape($response->json());
});

it('fails with project.name_taken on case and trim conflict (T-PJ-101)', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => 'HCI',
        'colour' => 'blue',
    ])->assertStatus(201);

    $response = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => 'hci ',
        'colour' => 'red',
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('project.name_taken')
        ->and($response->json('error.message'))->toBe('You already have a project called “HCI”.')
        ->and($response->json('error.fields.name'))->toBe(['You already have a project called “HCI”.']);

    assertProjectApiErrorShape($response->json());
});

it('rejects the 51st project with project.limit (T-PJ-102)', function () {
    $user = User::factory()->create();

    for ($i = 1; $i <= ProjectController::LIMIT; $i++) {
        Project::forceCreate([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => "Project {$i}",
            'colour' => 'blue',
        ]);
    }

    $response = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => 'Project 51',
        'colour' => 'green',
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('project.limit')
        ->and($response->json('error.message'))->toBe('You can have up to 50 projects.')
        ->and(Project::where('user_id', $user->id)->count())->toBe(ProjectController::LIMIT);

    assertProjectApiErrorShape($response->json());
});

it('accepts a name of 40 emoji and rejects 41 (T-PJ-108)', function () {
    $user = User::factory()->create();

    $name40 = str_repeat('😀', 40);
    $response40 = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => $name40,
        'colour' => 'yellow',
    ])->assertStatus(201);

    expect($response40->json('name'))->toBe($name40);
    assertProjectSchema($response40->json());

    $name41 = str_repeat('😀', 41);
    $response41 = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => $name41,
        'colour' => 'yellow',
    ])->assertStatus(422);

    expect($response41->json('error.fields'))->toHaveKey('name');
    assertProjectApiErrorShape($response41->json());
});

it('rejects an invalid colour with 422', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => 'Valid Name',
        'colour' => 'magenta',
    ])->assertStatus(422);

    expect($response->json('error.fields'))->toHaveKey('colour');
    assertProjectApiErrorShape($response->json());
});

it('returns 401 for guests on both routes', function () {
    $this->getJson('/api/v1/projects')->assertStatus(401);

    $this->postJson('/api/v1/projects', [
        'id' => (string) Str::uuid(),
        'name' => 'Guest Project',
        'colour' => 'blue',
    ])->assertStatus(401);
});

it('shows a project with its tasks, progress counts, and valid schemas', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Workspace',
        'colour' => 'blue',
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Open Task 1',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Open Task 2',
        'done' => false,
    ]);
    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Completed Task 1',
        'done' => true,
        'done_at' => Carbon::now(),
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/projects/{$project->id}")
        ->assertStatus(200);

    $data = $response->json();
    expect($data)->toHaveKeys(['project', 'progress', 'open', 'completed', 'next_cursor'])
        ->and($data['progress'])->toBe(['done' => 1, 'total' => 3])
        ->and($data['project']['open'])->toBe(2)
        ->and($data['project']['done'])->toBe(1)
        ->and($data['open'])->toHaveCount(2)
        ->and($data['completed'])->toHaveCount(1)
        ->and($data['next_cursor'])->toBeNull();

    assertProjectSchema($data['project']);
    assertProjectTaskSchema($data['open'][0]);
    assertProjectTaskSchema($data['completed'][0]);
});

it('orders open tasks by due_date (nulls last), then priority (high, medium, low, null), then created_at', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Task Ordering Project',
        'colour' => 'teal',
    ]);

    $t1 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T1 due tomorrow high',
        'due_date' => '2026-10-25',
        'priority' => 'high',
        'done' => false,
        'created_at' => Carbon::parse('2026-10-20 10:00:00'),
    ]);

    $t2 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T2 due today low',
        'due_date' => '2026-10-24',
        'priority' => 'low',
        'done' => false,
        'created_at' => Carbon::parse('2026-10-20 10:00:00'),
    ]);

    $t3 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T3 due today medium',
        'due_date' => '2026-10-24',
        'priority' => 'medium',
        'done' => false,
        'created_at' => Carbon::parse('2026-10-20 10:00:00'),
    ]);

    $t4 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T4 due today high',
        'due_date' => '2026-10-24',
        'priority' => 'high',
        'done' => false,
        'created_at' => Carbon::parse('2026-10-20 10:00:00'),
    ]);

    $t5 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T5 due null high early',
        'due_date' => null,
        'priority' => 'high',
        'done' => false,
        'created_at' => Carbon::parse('2026-10-20 08:00:00'),
    ]);

    $t6 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T6 due null high late',
        'due_date' => null,
        'priority' => 'high',
        'done' => false,
        'created_at' => Carbon::parse('2026-10-21 08:00:00'),
    ]);

    $t7 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'T7 due null no priority',
        'due_date' => null,
        'priority' => null,
        'done' => false,
        'created_at' => Carbon::parse('2026-10-19 08:00:00'),
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/projects/{$project->id}")
        ->assertStatus(200);

    $openIds = array_column($response->json('open'), 'id');
    expect($openIds)->toBe([
        $t4->id,
        $t3->id,
        $t2->id,
        $t1->id,
        $t5->id,
        $t6->id,
        $t7->id,
    ]);
});

it('pages completed tasks with cursor (12 completed -> 10 + cursor, then 2 + null cursor)', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Paging Project',
        'colour' => 'purple',
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Open Task Stays',
        'done' => false,
    ]);

    $completedIds = [];
    $baseTime = Carbon::parse('2026-10-23 01:00:00Z');
    for ($i = 1; $i <= 12; $i++) {
        $task = Task::forceCreate([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'project_id' => $project->id,
            'title' => "Completed Task {$i}",
            'done' => true,
            'done_at' => (clone $baseTime)->addMinutes($i),
        ]);
        $completedIds[] = $task->id;
    }

    // Expected order: newest completed first (task 12 down to task 1)
    $expectedOrder = array_reverse($completedIds);

    // 1st request: without cursor -> first 10
    $res1 = $this->actingAs($user)->getJson("/api/v1/projects/{$project->id}")
        ->assertStatus(200);

    $completedPage1 = $res1->json('completed');
    expect($completedPage1)->toHaveCount(10)
        ->and(array_column($completedPage1, 'id'))->toBe(array_slice($expectedOrder, 0, 10))
        ->and($res1->json('open'))->toHaveCount(1)
        ->and($res1->json('next_cursor'))->not->toBeNull();

    $cursor = $res1->json('next_cursor');

    // 2nd request: with cursor -> remaining 2, next_cursor is null, open remains
    $res2 = $this->actingAs($user)->getJson("/api/v1/projects/{$project->id}?cursor={$cursor}")
        ->assertStatus(200);

    $completedPage2 = $res2->json('completed');
    expect($completedPage2)->toHaveCount(2)
        ->and(array_column($completedPage2, 'id'))->toBe(array_slice($expectedOrder, 10, 2))
        ->and($res2->json('open'))->toHaveCount(1)
        ->and($res2->json('next_cursor'))->toBeNull();
});

it('returns 404 on show for another user\'s project, deleted project, or unknown id', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $otherProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'name' => 'Other Project',
        'colour' => 'blue',
    ]);

    $deletedProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Deleted Project',
        'colour' => 'red',
        'deleted_at' => Carbon::now(),
    ]);

    $unknownId = (string) Str::uuid();

    $this->actingAs($user)->getJson("/api/v1/projects/{$otherProject->id}")
        ->assertStatus(404);

    $this->actingAs($user)->getJson("/api/v1/projects/{$deletedProject->id}")
        ->assertStatus(404);

    $this->actingAs($user)->getJson("/api/v1/projects/{$unknownId}")
        ->assertStatus(404);
});

it('renames a project and returns 200 with project item', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Old Name',
        'colour' => 'blue',
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/projects/{$project->id}", [
        'name' => '  Renamed Project  ',
    ])->assertStatus(200);

    expect($response->json('name'))->toBe('Renamed Project')
        ->and($response->json('colour'))->toBe('blue')
        ->and($response->json('open'))->toBe(0)
        ->and($response->json('done'))->toBe(0);

    assertProjectSchema($response->json());
    expect($project->fresh()->name)->toBe('Renamed Project');
});

it('recolours a project and returns 200 with project item', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Colour Test',
        'colour' => 'blue',
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/projects/{$project->id}", [
        'colour' => 'purple',
    ])->assertStatus(200);

    expect($response->json('name'))->toBe('Colour Test')
        ->and($response->json('colour'))->toBe('purple');

    assertProjectSchema($response->json());
    expect($project->fresh()->colour)->toBe('purple');
});

it('rejects patch with name taken by another non-deleted project with 422 but allows keeping its own name', function () {
    $user = User::factory()->create();
    $projectA = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Design System',
        'colour' => 'green',
    ]);
    $projectB = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Mobile App',
        'colour' => 'orange',
    ]);

    // Name taken by project A
    $responseTaken = $this->actingAs($user)->patchJson("/api/v1/projects/{$projectB->id}", [
        'name' => '  design SYSTEM  ',
    ])->assertStatus(422);

    expect($responseTaken->json('error.code'))->toBe('project.name_taken')
        ->and($responseTaken->json('error.message'))->toBe('You already have a project called “Design System”.');
    assertProjectApiErrorShape($responseTaken->json());

    // Keeping its own name (case variation or identical) is allowed
    $responseSelf = $this->actingAs($user)->patchJson("/api/v1/projects/{$projectB->id}", [
        'name' => 'Mobile App',
    ])->assertStatus(200);

    expect($responseSelf->json('name'))->toBe('Mobile App');
});

it('rejects patch with unknown keys with 422', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Test Project',
        'colour' => 'gray',
    ]);

    $response = $this->actingAs($user)->patchJson("/api/v1/projects/{$project->id}", [
        'name' => 'Valid Name',
        'extra_field' => 'not_allowed',
    ])->assertStatus(422);

    expect($response->json('error.fields.extra_field'))->toContain("This field can't be changed.");
    assertProjectApiErrorShape($response->json());
});

it('returns 404 on patch for another user\'s project or deleted project', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $otherProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'name' => 'Other Project',
        'colour' => 'blue',
    ]);

    $deletedProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Deleted Project',
        'colour' => 'red',
        'deleted_at' => Carbon::now(),
    ]);

    $this->actingAs($user)->patchJson("/api/v1/projects/{$otherProject->id}", [
        'name' => 'Attempt Rename',
    ])->assertStatus(404);

    $this->actingAs($user)->patchJson("/api/v1/projects/{$deletedProject->id}", [
        'name' => 'Attempt Rename Deleted',
    ])->assertStatus(404);
});

it('deletes a project with move mode, unlinking tasks and setting project_id update timestamp', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Delete Move Project',
        'colour' => 'blue',
    ]);

    $task1 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Task 1 to move',
        'done' => false,
    ]);
    $task2 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Task 2 to move',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}?tasks=move")
        ->assertStatus(200);

    expect($response->json('undo.mode'))->toBe('move')
        ->and($response->json('undo.task_ids'))->toHaveCount(2)
        ->and($response->json('undo.task_ids'))->toContain($task1->id, $task2->id);

    $freshProject = Project::withoutGlobalScope('owner')->find($project->id);
    expect($freshProject->deleted_at)->not->toBeNull();

    $fresh1 = Task::find($task1->id);
    $fresh2 = Task::find($task2->id);
    expect($fresh1->project_id)->toBeNull()
        ->and($fresh1->deleted_at)->toBeNull()
        ->and($fresh1->field_updated_at['project_id'])->toBe('2026-10-23T01:12:00Z')
        ->and($fresh2->project_id)->toBeNull()
        ->and($fresh2->deleted_at)->toBeNull()
        ->and($fresh2->field_updated_at['project_id'])->toBe('2026-10-23T01:12:00Z');
});

it('deletes a project with delete mode, soft-deleting tasks and setting deleted update timestamp', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Delete Delete Project',
        'colour' => 'green',
    ]);

    $task1 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Task 1 to delete',
        'done' => false,
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}?tasks=delete")
        ->assertStatus(200);

    expect($response->json('undo.mode'))->toBe('delete')
        ->and($response->json('undo.task_ids'))->toBe([$task1->id]);

    $freshProject = Project::withoutGlobalScope('owner')->find($project->id);
    expect($freshProject->deleted_at)->not->toBeNull();

    $freshTask = Task::withTrashed()->find($task1->id);
    expect($freshTask->trashed())->toBeTrue()
        ->and($freshTask->deleted_at->toIso8601String())->toBe(Carbon::parse($freshProject->deleted_at)->toIso8601String())
        ->and($freshTask->field_updated_at['deleted'])->toBe('2026-10-23T01:12:00Z');
});

it('deletes a project with no tasks returning empty task_ids and move mode', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Empty Project',
        'colour' => 'yellow',
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}")
        ->assertStatus(200);

    expect($response->json('undo'))->toBe([
        'task_ids' => [],
        'mode' => 'move',
    ]);

    $freshProject = Project::withoutGlobalScope('owner')->find($project->id);
    expect($freshProject->deleted_at)->not->toBeNull();
});

it('rejects delete with 422 if project has tasks and tasks parameter is missing or invalid', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Has Tasks Project',
        'colour' => 'red',
    ]);

    Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Some Task',
        'done' => false,
    ]);

    // Missing tasks parameter
    $resMissing = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}")
        ->assertStatus(422);

    expect($resMissing->json('error.fields.tasks'))->not->toBeEmpty();
    assertProjectApiErrorShape($resMissing->json());

    // Invalid tasks parameter
    $resInvalid = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}?tasks=archive")
        ->assertStatus(422);

    expect($resInvalid->json('error.fields.tasks'))->not->toBeEmpty();
    assertProjectApiErrorShape($resInvalid->json());
});

it('restores a project and its moved tasks with 200', function () {
    $clock = new FrozenClock('2026-10-23T01:12:00Z');
    app()->instance(ClockInterface::class, $clock);

    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Restore Move Project',
        'colour' => 'teal',
    ]);

    $task1 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Moved Task 1',
        'done' => false,
    ]);

    // Delete with move
    $delRes = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}?tasks=move")
        ->assertStatus(200);

    $undo = $delRes->json('undo');

    // Advance clock for restore
    $clock->advance('+5 minutes');

    // Restore
    $res = $this->actingAs($user)->postJson("/api/v1/projects/{$project->id}/restore", $undo)
        ->assertStatus(200);

    expect($res->json('id'))->toBe($project->id)
        ->and($res->json('open'))->toBe(1)
        ->and($res->json('done'))->toBe(0);
    assertProjectSchema($res->json());

    $freshProject = Project::find($project->id);
    expect($freshProject->deleted_at)->toBeNull();

    $freshTask = Task::find($task1->id);
    expect($freshTask->project_id)->toBe($project->id)
        ->and($freshTask->field_updated_at['project_id'])->toBe('2026-10-23T01:17:00Z');
});

it('restores a project and its deleted tasks with 200', function () {
    $clock = new FrozenClock('2026-10-23T01:12:00Z');
    app()->instance(ClockInterface::class, $clock);

    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Restore Delete Project',
        'colour' => 'orange',
    ]);

    $task1 = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'project_id' => $project->id,
        'title' => 'Deleted Task 1',
        'done' => false,
    ]);

    // Delete with delete
    $delRes = $this->actingAs($user)->deleteJson("/api/v1/projects/{$project->id}?tasks=delete")
        ->assertStatus(200);

    $undo = $delRes->json('undo');

    // Advance clock for restore
    $clock->advance('+5 minutes');

    // Restore
    $res = $this->actingAs($user)->postJson("/api/v1/projects/{$project->id}/restore", $undo)
        ->assertStatus(200);

    expect($res->json('id'))->toBe($project->id)
        ->and($res->json('open'))->toBe(1);
    assertProjectSchema($res->json());

    $freshProject = Project::find($project->id);
    expect($freshProject->deleted_at)->toBeNull();

    $freshTask = Task::find($task1->id);
    expect($freshTask->trashed())->toBeFalse()
        ->and($freshTask->field_updated_at['deleted'])->toBe('2026-10-23T01:17:00Z');
});

it('returns 200 no-op if the restored project is not deleted', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Active Project',
        'colour' => 'blue',
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/projects/{$project->id}/restore", [
        'task_ids' => [],
        'mode' => 'move',
    ])->assertStatus(200);

    expect($response->json('id'))->toBe($project->id);
    assertProjectSchema($response->json());
});

it('rejects restore with 422 project.name_taken if a project with the same name now exists', function () {
    $user = User::factory()->create();
    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Conflict Project',
        'colour' => 'blue',
        'deleted_at' => Carbon::now(),
    ]);

    // Another project with the same name created since
    Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'conflict project',
        'colour' => 'red',
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/projects/{$project->id}/restore", [
        'task_ids' => [],
        'mode' => 'move',
    ])->assertStatus(422);

    expect($response->json('error.code'))->toBe('project.name_taken');
    assertProjectApiErrorShape($response->json());
});

it('rejects restore with foreign task id or task not matching delete with 422 and restores nothing', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $project = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'name' => 'Restore Check Project',
        'colour' => 'purple',
        'deleted_at' => Carbon::now(),
    ]);

    $foreignTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'title' => 'Foreign Task',
        'done' => false,
    ]);

    // Foreign task ID
    $resForeign = $this->actingAs($user)->postJson("/api/v1/projects/{$project->id}/restore", [
        'task_ids' => [$foreignTask->id],
        'mode' => 'move',
    ])->assertStatus(422);

    expect($resForeign->json('error.fields.task_ids'))->not->toBeEmpty();
    assertProjectApiErrorShape($resForeign->json());

    // Project is still deleted
    $freshProject = Project::withoutGlobalScope('owner')->find($project->id);
    expect($freshProject->deleted_at)->not->toBeNull();

    // Mismatched task: deleted task with move mode
    $deletedTask = Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'Deleted Task',
        'done' => false,
        'deleted_at' => Carbon::now(),
    ]);

    $resMismatch = $this->actingAs($user)->postJson("/api/v1/projects/{$project->id}/restore", [
        'task_ids' => [$deletedTask->id],
        'mode' => 'move',
    ])->assertStatus(422);

    expect($resMismatch->json('error.fields.task_ids'))->not->toBeEmpty();
});

it('returns 404 on delete and restore for another user\'s project', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $otherProject = Project::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $otherUser->id,
        'name' => 'Other Project',
        'colour' => 'blue',
    ]);

    $this->actingAs($user)->deleteJson("/api/v1/projects/{$otherProject->id}?tasks=move")
        ->assertStatus(404);

    $this->actingAs($user)->postJson("/api/v1/projects/{$otherProject->id}/restore", [
        'task_ids' => [],
        'mode' => 'move',
    ])->assertStatus(404);
});
