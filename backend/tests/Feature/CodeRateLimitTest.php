<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Support\RateLimitedClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->clock = new RateLimitedClock('2026-11-12T10:00:00+00:00');
    $this->app->instance(ClockInterface::class, $this->clock);
    Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response('0000000000000000000000000000000000A:3')]);
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
});

it('PR #153: a new two-factor code can be sent 60 s after the last one', function () {
    User::factory()->create([
        'email' => 'twofactor-cooldown@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $loginResponse = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'twofactor-cooldown@example.com',
        'password' => 'secret1234',
    ])->assertStatus(202);

    $sessionCookies = carryCookies($loginResponse) + $cookies;

    $resend = $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');

    expect($resend->json('error.retry_after'))->toBeGreaterThanOrEqual(1)->toBeLessThanOrEqual(60);

    $this->clock->advance('+60 seconds');

    $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/resend')->assertNoContent();
});

it('allows 5 two-step on/off changes per 2 minutes: the 6th answers 429 until the 2 minutes pass', function () {
    $user = User::factory()->create();
    $toggle = fn () => $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/two-factor', ['enabled' => true]);

    for ($i = 1; $i <= 5; $i++) {
        $toggle()->assertOk();
    }

    // Still blocked after 1 minute: the window is 2 minutes
    $this->clock->advance('+61 seconds');
    $toggle()->assertStatus(429)->assertJsonPath('error.code', 'error.rate_limited');

    $this->clock->advance('+60 seconds');
    $toggle()->assertOk();
});
