<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// IM-14: POST /auth/logout and /auth/logout-everywhere (AA-5)
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
    $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'password 1']);
});

/** A request from a browser holding only these cookies. */
function asDevice(array $cookies = []): TestCase
{
    newRequest();
    // The cookie jar is protected and the test client has no way to empty it
    (fn () => $this->defaultCookies = $this->unencryptedCookies = [])->call(test()->target);

    return test()->withCookies($cookies);
}

/** Signs in a fresh browser with Remember me and returns its cookies. */
function signInDevice(): array
{
    $cookies = carryCookies(asDevice()->get('/sanctum/csrf-cookie'));
    $login = asDevice($cookies)->postJson('/api/v1/auth/login', ['email' => 'example@gmail.com', 'password' => 'password 1', 'remember' => true])->assertOk();

    return carryCookies($login) + $cookies;
}

it('T-AA-40, SEC-50: ends this session and forgets Remember me', function () {
    $device = signInDevice();
    $response = asDevice($device)->postJson('/api/v1/auth/logout')->assertNoContent();

    $recaller = collect($response->headers->getCookies())->first(fn ($c) => str_starts_with($c->getName(), 'remember_web_'));
    expect($recaller?->getExpiresTime())->toBeLessThan(time())
        ->and(DB::table('sessions')->where('user_id', $this->user->id)->count())->toBe(0);
    asDevice([SESSION_COOKIE => $device[SESSION_COOKIE]])->getJson('/api/v1/me')->assertUnauthorized();
});

it('leaves other devices signed in, Remember me included', function () {
    $other = signInDevice();
    $token = $this->user->fresh()->getRememberToken();
    asDevice(signInDevice())->postJson('/api/v1/auth/logout')->assertNoContent();

    asDevice($other)->getJson('/api/v1/me')->assertOk();
    expect($this->user->fresh()->getRememberToken())->toBe($token);
});

it('answers 204 when the session already ended, so the client can finish', function () {
    $cookies = carryCookies($this->get('/sanctum/csrf-cookie'));
    asDevice($cookies)->postJson('/api/v1/auth/logout')->assertNoContent();
});

it('T-AA-43: sign out on all devices ends every session and is audited', function () {
    $other = signInDevice();
    $token = $this->user->fresh()->getRememberToken();
    asDevice(signInDevice())->postJson('/api/v1/auth/logout-everywhere')->assertNoContent();

    asDevice($other)->getJson('/api/v1/me')->assertUnauthorized();
    expect($this->user->fresh()->getRememberToken())->not->toBe($token)
        ->and(DB::table('audit_events')->where(['user_id' => $this->user->id, 'event' => 'sign_out_everywhere'])->exists())->toBeTrue();
});

it('refuses sign out on all devices when signed out', function () {
    $cookies = carryCookies($this->get('/sanctum/csrf-cookie'));
    asDevice($cookies)->postJson('/api/v1/auth/logout-everywhere')->assertUnauthorized();
});
