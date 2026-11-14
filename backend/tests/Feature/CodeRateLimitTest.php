<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailCode;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
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

it('PR #153: a code dies on its 5th wrong try and only a new code works', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'die5th@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'die5th@example.com')->firstOrFail();

    $latestCode = '';
    Notification::assertSentTo($user, VerifyEmailCode::class, function (VerifyEmailCode $notification) use (&$latestCode) {
        $latestCode = $notification->code;

        return true;
    });
    $firstCode = $latestCode;

    foreach (range(1, 4) as $i) {
        $this->actingAs($user)->postJson('/api/v1/auth/verify-email', ['code' => '000000'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'auth.verify_wrong');
    }

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', ['code' => '000000'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many');

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', ['code' => $firstCode])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many');

    $this->clock->advance('+60 seconds');

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertNoContent();

    Notification::assertSentTo($user, VerifyEmailCode::class, function (VerifyEmailCode $notification) use (&$latestCode) {
        $latestCode = $notification->code;

        return true;
    });
    $newCode = $latestCode;

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', ['code' => $newCode])
        ->assertOk();
});

it('PR #153: a new code can be sent 60 s after the last one', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'cooldown60@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'cooldown60@example.com')->firstOrFail();

    $resend = $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');

    expect($resend->json('error.retry_after'))->toBeGreaterThanOrEqual(1)->toBeLessThanOrEqual(60);

    $this->clock->advance('+60 seconds');

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertNoContent();
});

it('PR #153: 10 codes in 30 minutes, then a 30-minute wait', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'limit10@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'limit10@example.com')->firstOrFail();

    for ($i = 1; $i <= 9; $i++) {
        $this->clock->advance('+60 seconds');
        $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertNoContent();
    }

    $this->clock->advance('+60 seconds');
    $blocked = $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');

    expect($blocked->json('error.retry_after'))->toBeGreaterThan(1700);

    $this->clock->advance('+30 minutes');
    $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertNoContent();
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
