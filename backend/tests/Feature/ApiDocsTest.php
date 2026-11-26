<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

// IM-08 (#197): the generated API docs at /docs/api, open locally, allow-listed elsewhere
uses(RefreshDatabase::class);

function apiDocs(): array
{
    config(['telescope.allowed_emails' => ['docs@example.com']]);
    test()->actingAs(User::factory()->create(['email' => 'docs@example.com']));

    return test()->getJson('/docs/api.json')->assertOk()->json();
}

it('documents every /api/v1 route', function () {
    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v1/'))
        ->map(fn ($route) => strtolower($route->methods()[0]).' /'.substr($route->uri(), strlen('api/v1/')))
        ->sort()->values()->all();

    $documented = collect(apiDocs()['paths'])
        ->flatMap(fn (array $operations, string $path) => array_map(fn (string $method) => "{$method} {$path}", array_keys($operations)))
        ->sort()->values()->all();

    expect($documented)->toBe($routes);
});

it('opens the docs only to allow-listed accounts outside local', function () {
    config(['telescope.allowed_emails' => ['docs@example.com']]);

    $this->get('/docs/api')->assertForbidden();
    $this->actingAs(User::factory()->create(['email' => 'other@example.com']))->get('/docs/api')->assertForbidden();
    $this->actingAs(User::factory()->create(['email' => 'docs@example.com']))->get('/docs/api')->assertOk();
});

it('documents the session, the CSRF header and the one error shape', function () {
    $docs = apiDocs();
    $error = ['$ref' => '#/components/schemas/ApiError'];

    expect(array_keys($docs['components']['securitySchemes']))->toBe(['session', 'csrf'])
        ->and($docs['components']['schemas']['ApiError']['required'])->toBe(['error'])
        // Public write: CSRF only. Signed-in read: the session only. Public read: nothing
        ->and($docs['paths']['/auth/login']['post']['security'])->toBe([['csrf' => []]])
        ->and($docs['paths']['/me']['get']['security'])->toBe([['session' => []]])
        ->and($docs['paths']['/health']['get']['security'])->toBe([])
        ->and($docs['paths']['/tasks']['post']['security'])->toBe([['session' => [], 'csrf' => []]])
        ->and($docs['paths']['/tasks']['post']['responses']['422']['content']['application/json']['schema'])->toBe($error)
        ->and($docs['paths']['/tasks/{task}']['get']['responses']['404']['content']['application/json']['schema'])->toBe($error)
        ->and($docs['paths']['/me']['get']['responses']['401']['content']['application/json']['schema'])->toBe($error)
        ->and($docs['paths']['/me']['get']['responses']['429']['content']['application/json']['schema'])->toBe($error);
});
