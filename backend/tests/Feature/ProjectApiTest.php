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

it('rejects an id taken by another user with 422', function () {
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
    ])->assertStatus(422);

    expect($response->json('error.fields.id'))->toContain('The id has already been taken.');
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
