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
    // 30 presses per 10 minutes; the 5-different-emails-an-hour rule is PendingSignup's (RegisterTest)
    'register' => ['register', [[30, 600]]],
    'POST /notes' => ['notes', [[30, 60], [300, 86400]]],
    'POST /files/extract' => ['files', [[10, 3600], [30, 86400]]],
    'search' => ['search', [[60, 60]]],
    'sync' => ['sync', [[30, 60]]],
    'everything else, user' => ['api', [[150, 60], [20, 1]]],
]);

it('SEC-10: guests get 150 a minute and 20 a second per IP', function () {
    expect(limitsOf('api'))->toBe([[150, 60], [20, 1]]);
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

it('SEC-10: a guest is counted on signed-in routes too, so flooding them past the limit answers 429', function () {
    Route::middleware(['api', 'auth:sanctum'])->prefix('api/v1')->get('_mine', fn () => ['ok' => true]);
    RateLimiter::for('api', fn () => Limit::perMinute(2)->by('test'));

    $this->getJson('/api/v1/_mine')->assertUnauthorized();
    $this->getJson('/api/v1/_mine')->assertUnauthorized();
    $this->getJson('/api/v1/_mine')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');
});

it('UX-43: a 429 names the limit it hit: 20 at once is a burst, 150 in a minute is the window', function () {
    Route::middleware('api')->prefix('api/v1')->get('_ping', fn () => ['ok' => true]);
    $this->freezeTime();

    // 21 in one second: the burst cap
    foreach (range(1, 20) as $ignored) {
        $this->getJson('/api/v1/_ping')->assertOk();
    }
    $this->getJson('/api/v1/_ping')->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited')
        ->assertJsonPath('error.limit', ['max' => 20, 'window' => 1]);

    // 20 a second after that, under the burst cap, until the minute's 150 are used
    $sent = 20;
    while ($sent < 150) {
        $this->travel(1)->seconds();
        foreach (range(1, min(20, 150 - $sent)) as $ignored) {
            $this->getJson('/api/v1/_ping')->assertOk();
            $sent++;
        }
    }
    $this->travel(1)->seconds();
    $this->getJson('/api/v1/_ping')->assertStatus(429)
        ->assertJsonPath('error.limit', ['max' => 150, 'window' => 60]);
});
