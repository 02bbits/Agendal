<?php

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

// IM-15: rate limits (NF-13, SEC-10)
uses(RefreshDatabase::class);

/** The limits a named limiter hands a request, as [maxAttempts, decaySeconds]. */
function limitsOf(string $name, ?User $user = null): array
{
    $request = Request::create('/');
    $request->setUserResolver(fn () => $user);

    return collect(Arr::wrap(RateLimiter::limiter($name)($request)))
        ->map(fn (Limit $limit) => [$limit->maxAttempts, $limit->decaySeconds])->all();
}

it('SEC-10: every NF-13 limit is defined', function (string $name, array $expected) {
    expect(limitsOf($name, User::factory()->create()))->toBe($expected);
})->with([
    'register' => ['register', [[5, 3600]]],
    'POST /notes' => ['notes', [[30, 60], [300, 86400]]],
    'POST /files/extract' => ['files', [[10, 3600], [30, 86400]]],
    'search' => ['search', [[60, 60]]],
    'sync' => ['sync', [[30, 60]]],
    'everything else, user' => ['api', [[120, 60]]],
]);

it('SEC-10: guests get 300 a minute per IP', function () {
    expect(limitsOf('api'))->toBe([[300, 60]]);
});

it('SEC-10: past the limit the API answers 429 with Retry-After and the rate-limit code', function () {
    Route::middleware('api')->prefix('api/v1')->get('_ping', fn () => ['ok' => true]);
    $user = User::factory()->create();
    RateLimiter::for('api', fn () => Limit::perMinute(2)->by('test'));

    $this->actingAs($user, 'sanctum')->getJson('/api/v1/_ping')->assertOk();
    $this->actingAs($user, 'sanctum')->getJson('/api/v1/_ping')->assertOk();
    $this->actingAs($user, 'sanctum')->getJson('/api/v1/_ping')
        ->assertStatus(429)
        ->assertHeader('Retry-After')
        ->assertJsonPath('error.code', 'error.rate_limited');
});
