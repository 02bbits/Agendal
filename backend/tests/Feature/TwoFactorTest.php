<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Controllers\Auth\LoginController;
use App\Models\User;
use App\Notifications\SignInCode;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->clock = new FrozenClock('2026-11-12T10:00:00+00:00');
    $this->app->instance(ClockInterface::class, $this->clock);
    Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response('0000000000000000000000000000000000A:3')]);
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
});

it('masked email format keeps first character of local part and domain', function () {
    expect(LoginController::maskEmail('example@gmail.com'))->toBe('e******@gmail.com')
        ->and(LoginController::maskEmail('alex@example.com'))->toBe('a***@example.com')
        ->and(LoginController::maskEmail('a@example.com'))->toBe('a*@example.com');
});

it('login with 2FA off is unchanged', function () {
    $user = User::factory()->create([
        'email' => 'regular@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => false,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $response = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'regular@example.com',
        'password' => 'secret1234',
        'remember' => false,
    ])->assertOk();

    expect($response->json('user.id'))->toBe($user->id);

    $loginCookies = carryCookies($response) + $cookies;
    $this->withCookies($loginCookies)->getJson('/api/v1/me')->assertOk();

    expect(DB::table('audit_events')->where(['user_id' => $user->id, 'event' => 'sign_in'])->exists())->toBeTrue();
});

it('login with 2FA on returns 202 and is not signed in (GET /me 401)', function () {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'example@gmail.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $response = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'example@gmail.com',
        'password' => 'secret1234',
        'remember' => true,
    ])->assertStatus(202)
        ->assertJson([
            'two_factor' => true,
            'email' => 'e******@gmail.com',
        ]);

    $sessionCookies = carryCookies($response) + $cookies;
    $this->withCookies($sessionCookies)->getJson('/api/v1/me')->assertUnauthorized();

    Notification::assertSentTo($user, SignInCode::class, function (SignInCode $notification) {
        return preg_match('/^\d{6}$/', $notification->code) === 1;
    });
});

it('challenge with the code signs in and honours remember', function () {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'remember@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $loginResponse = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'remember@example.com',
        'password' => 'secret1234',
        'remember' => true,
    ])->assertStatus(202);

    $code = '';
    Notification::assertSentTo($user, SignInCode::class, function (SignInCode $n) use (&$code) {
        $code = $n->code;

        return true;
    });

    $sessionCookies = carryCookies($loginResponse) + $cookies;

    $challengeResponse = $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/challenge', [
        'code' => $code,
    ])->assertOk();

    expect($challengeResponse->json('user.id'))->toBe($user->id);

    $rememberCookie = collect($challengeResponse->headers->getCookies())
        ->first(fn ($c) => str_starts_with($c->getName(), 'remember_web_'));
    expect($rememberCookie)->not->toBeNull();

    $authedCookies = carryCookies($challengeResponse) + $sessionCookies;
    $this->withCookies($authedCookies)->getJson('/api/v1/me')->assertOk();

    expect(DB::table('audit_events')->where(['user_id' => $user->id, 'event' => 'sign_in_two_factor'])->exists())->toBeTrue();
});

it('challenge without remember sets no remember cookie', function () {
    Notification::fake();
    newRequest();

    $user = User::factory()->create([
        'email' => 'noremember@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $loginResponse = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'noremember@example.com',
        'password' => 'secret1234',
        'remember' => false,
    ])->assertStatus(202);

    $code = '';
    Notification::assertSentTo($user, SignInCode::class, function (SignInCode $n) use (&$code) {
        $code = $n->code;

        return true;
    });

    $sessionCookies = carryCookies($loginResponse) + $cookies;
    $challengeResponse = $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/challenge', [
        'code' => $code,
    ])->assertOk();

    expect(collect($challengeResponse->headers->getCookies())->contains(fn ($c) => str_starts_with($c->getName(), 'remember_web_')))->toBeFalse();
});

it('wrong code 422 and 5 tries before lockout', function () {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'tries@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $loginResponse = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'tries@example.com',
        'password' => 'secret1234',
    ])->assertStatus(202);

    $code = '';
    Notification::assertSentTo($user, SignInCode::class, function (SignInCode $n) use (&$code) {
        $code = $n->code;

        return true;
    });

    $sessionCookies = carryCookies($loginResponse) + $cookies;

    for ($i = 1; $i <= 5; $i++) {
        $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/challenge', [
            'code' => '000000',
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'auth.verify_wrong')
            ->assertJsonPath('error.fields.code.0', "That code isn't right. Try again.");
    }

    // 6th try with correct code fails with auth.verify_too_many
    $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/challenge', [
        'code' => $code,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many')
        ->assertJsonPath('error.fields.code.0', 'Too many tries. Send a new code.');
});

it('expired pending 422', function () {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'expired@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    // Call challenge with no pending 2FA session
    $this->withCookies($cookies)->postJson('/api/v1/auth/two-factor/challenge', [
        'code' => '123456',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.two_factor_expired')
        ->assertJsonPath('error.message', 'This sign-in has expired. Sign in again.');

    // Now start login
    $loginResponse = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'expired@example.com',
        'password' => 'secret1234',
    ])->assertStatus(202);

    $code = '';
    Notification::assertSentTo($user, SignInCode::class, function (SignInCode $n) use (&$code) {
        $code = $n->code;

        return true;
    });

    $sessionCookies = carryCookies($loginResponse) + $cookies;

    // Advance clock past 10 minutes
    $this->clock->advance('+11 minutes');

    $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/challenge', [
        'code' => $code,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.two_factor_expired')
        ->assertJsonPath('error.message', 'This sign-in has expired. Sign in again.');
});

it('resend gap 429', function () {
    Notification::fake();

    $user = User::factory()->create([
        'email' => 'resend@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $loginResponse = $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'resend@example.com',
        'password' => 'secret1234',
    ])->assertStatus(202);

    $sessionCookies = carryCookies($loginResponse) + $cookies;

    // Immediate resend within 45s
    $resendResponse = $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');

    expect($resendResponse->headers->has('Retry-After'))->toBeTrue();

    // Advance 46 seconds
    $this->clock->advance('+46 seconds');

    $this->withCookies($sessionCookies)->postJson('/api/v1/auth/two-factor/resend')
        ->assertNoContent();
});

it('enable 2FA without password', function () {
    $user = User::factory()->create([
        'email' => 'enable2fa@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => false,
    ]);

    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/two-factor', [
        'enabled' => true,
    ])->assertOk();

    expect($response->json('user.two_factor_enabled'))->toBeTrue()
        ->and($user->fresh()->two_factor_enabled)->toBeTrue();

    expect(DB::table('audit_events')->where(['user_id' => $user->id, 'event' => 'two_factor_on'])->exists())->toBeTrue();
});

it('disable 2FA needs the right password', function () {
    $user = User::factory()->create([
        'email' => 'disable2fa@example.com',
        'password' => 'secret1234',
        'two_factor_enabled' => true,
    ]);

    // Wrong password -> 422
    $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/two-factor', [
        'enabled' => false,
        'current_password' => 'wrong-pass',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.current_password_wrong');

    expect($user->fresh()->two_factor_enabled)->toBeTrue();

    // Right password -> 200
    $response = $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/two-factor', [
        'enabled' => false,
        'current_password' => 'secret1234',
    ])->assertOk();

    expect($response->json('user.two_factor_enabled'))->toBeFalse()
        ->and($user->fresh()->two_factor_enabled)->toBeFalse();

    expect(DB::table('audit_events')->where(['user_id' => $user->id, 'event' => 'two_factor_off'])->exists())->toBeTrue();
});

it('PATCH /me does not accept two_factor_enabled', function () {
    $user = User::factory()->create([
        'email' => 'patchme@example.com',
        'two_factor_enabled' => false,
    ]);

    $this->actingAs($user, 'sanctum')->patchJson('/api/v1/me', [
        'two_factor_enabled' => true,
    ])->assertOk();

    expect($user->fresh()->two_factor_enabled)->toBeFalse();
});
