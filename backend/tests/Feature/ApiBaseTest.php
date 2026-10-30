<?php

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Opis\JsonSchema\Validator;

// IM-08: the error shape, request IDs, headers, owner scoping and log hygiene every endpoint inherits
uses(RefreshDatabase::class);

function assertErrorShape(mixed $body): void
{
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', __DIR__.'/../../../docs/07-architecture/contracts/schemas/');
    $result = $validator->validate(json_decode(json_encode($body)), 'https://agendal.app/schemas/error.schema.json');

    expect($result->isValid())->toBeTrue();
}

beforeEach(function () {
    Route::middleware('api')->prefix('api/v1')->group(function () {
        Route::get('_boom', fn () => throw new RuntimeException('secret stack detail'));
        Route::post('_validate', fn () => request()->validate(['title' => 'required']));
        Route::middleware('auth:sanctum')->get('_tasks/{task}', fn (Task $task) => ['id' => $task->id]);
    });
});

it('T-AP-40: a 500 shows error.generic with the request ID and no stack trace', function () {
    $response = $this->getJson('/api/v1/_boom')->assertStatus(500);

    expect($response->json('error.code'))->toBe('error.generic')
        ->and($response->json('error.request_id'))->toBe($response->headers->get('X-Request-Id'))
        ->and($response->getContent())->not->toContain('secret stack detail')->not->toContain('trace');
    assertErrorShape($response->json());
});

it('uses the error shape for validation, sign-in and missing routes', function () {
    $invalid = $this->postJson('/api/v1/_validate')->assertStatus(422);
    expect($invalid->json('error.code'))->toBe('error.invalid')->and($invalid->json('error.fields'))->toHaveKey('title');

    $guest = $this->getJson('/api/v1/user')->assertUnauthorized();
    expect($guest->json('error.code'))->toBe('auth.session_expired');

    $missing = $this->getJson('/api/v1/nothing-here')->assertNotFound();
    expect($missing->json('error.code'))->toBe('error.not_found');

    collect([$invalid, $guest, $missing])->each(fn ($r) => assertErrorShape($r->json()));
});

it('SC-10: someone else\'s task is a 404, your own is found', function () {
    [$owner, $other] = User::factory()->count(2)->create();
    $task = Task::forceCreate(['user_id' => $owner->id, 'title' => 'SQL quiz']);

    $this->actingAs($other)->getJson("/api/v1/_tasks/{$task->id}")->assertNotFound();
    $this->actingAs($owner)->getJson("/api/v1/_tasks/{$task->id}")->assertOk()->assertJson(['id' => $task->id]);
    expect(Task::count())->toBe(1);
});

it('SEC-12: every API route needs a session unless it is public', function () {
    $public = ['api/v1/health', 'api/v1/auth/register', 'api/v1/auth/login', 'api/v1/auth/logout', 'api/v1/auth/forgot-password', 'api/v1/auth/reset-password', 'api/v1/_boom', 'api/v1/_validate'];

    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($r) => str_starts_with($r->uri(), 'api/v1/') && ! in_array($r->uri(), $public));

    expect($routes)->not->toBeEmpty();
    foreach ($routes as $route) {
        $uri = preg_replace('/\{[^}]+\}/', '00000000-0000-7000-8000-000000000000', $route->uri());
        foreach (array_diff($route->methods(), ['HEAD']) as $method) {
            expect($this->json($method, "/{$uri}")->status())->toBe(401, "{$method} /{$uri}");
        }
    }
});

it('NF-16: sends the security headers', function () {
    $response = $this->getJson('/api/v1/health');

    expect($response->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'none'")
        ->and($response->headers->get('X-Content-Type-Options'))->toBe('nosniff')
        ->and($response->headers->get('Strict-Transport-Security'))->toContain('max-age=31536000')
        ->and($response->headers->get('Referrer-Policy'))->toBe('strict-origin-when-cross-origin')
        ->and($response->headers->get('Permissions-Policy'))->toContain('microphone=(self)');
});

it('SC-21: a failed query logs no note or task text', function () {
    $logged = '';
    Event::listen(MessageLogged::class, function (MessageLogged $e) use (&$logged) {
        $logged .= $e->message.json_encode($e->context);
    });
    $user = User::factory()->create();

    Route::middleware('api')->get('api/v1/_bad-insert', fn () => DB::table('tasks')->insert([
        'id' => '00000000-0000-7000-8000-000000000001', 'user_id' => $user->id,
        'title' => 'my private plan', 'priority' => 'urgent',
    ]));
    $this->getJson('/api/v1/_bad-insert')->assertStatus(500);

    expect($logged)->toContain('Query failed')->not->toContain('my private plan');
});
