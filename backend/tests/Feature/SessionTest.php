<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;

// IM-10: Sanctum SPA sessions (ADR-007). Sign-in itself is IM-12, so a stand-in route signs in here.
uses(RefreshDatabase::class);

beforeEach(function () {
    // The database driver, as in production, so an expired session is really gone
    config(['session.driver' => 'database']);
    newRequest();
    Route::middleware('api')->post('api/v1/_sign-in', function (Request $request) {
        Auth::guard('web')->login(User::firstOrFail(), $request->boolean('remember'));

        return response()->noContent();
    });
    Route::middleware('api')->post('api/v1/_write', fn () => response()->noContent());
    $this->user = User::factory()->create();
    // Requests from the app's origin get a stateful session (SANCTUM_STATEFUL_DOMAINS),
    // and JSON test requests send cookies only with credentials, like fetch with credentials
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
});

function signIn(bool $remember): TestResponse
{
    $csrf = test()->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    return test()->withCookies($cookies)->withUnencryptedCookie('XSRF-TOKEN', $cookies['XSRF-TOKEN'])
        ->withHeader('X-XSRF-TOKEN', $cookies['XSRF-TOKEN'])
        ->postJson('/api/v1/_sign-in', ['remember' => $remember])
        ->assertNoContent();
}

it('SEC-01: the session cookie is __Host-, Secure, HttpOnly and SameSite=Lax', function () {
    $cookie = collect($this->get('/sanctum/csrf-cookie')->headers->getCookies())->firstWhere(fn ($c) => $c->getName() === SESSION_COOKIE);

    expect($cookie->isSecure())->toBeTrue()
        ->and($cookie->isHttpOnly())->toBeTrue()
        ->and($cookie->getSameSite())->toBe('lax')
        ->and($cookie->getPath())->toBe('/')
        ->and($cookie->getDomain())->toBeNull();
});

it('SEC-02: a write without the XSRF header is refused', function () {
    $cookies = carryCookies($this->get('/sanctum/csrf-cookie'));
    $this->app['env'] = 'local'; // Laravel skips the CSRF check while running tests

    $this->withCookies($cookies)->postJson('/api/v1/_write')->assertStatus(419);
    $this->withCookies($cookies)->withHeader('X-XSRF-TOKEN', $cookies['XSRF-TOKEN'])->postJson('/api/v1/_write')->assertNoContent();
});

it('T-AA-12: Remember me sets a 30-day cookie', function () {
    $remember = collect(signIn(remember: true)->headers->getCookies())
        ->first(fn ($c) => str_starts_with($c->getName(), 'remember_web_'));

    expect($remember)->not->toBeNull()
        ->and($remember->getExpiresTime())->toBe(now()->addDays(30)->getTimestamp())
        ->and($remember->isHttpOnly() && $remember->isSecure())->toBeTrue();
});

it('T-AA-13: without Remember me the session ends when the browser closes or after 2 h idle', function () {
    $response = signIn(remember: false);
    $cookies = carryCookies($response);

    expect(array_filter(array_keys($cookies), fn ($k) => str_starts_with($k, 'remember_web_')))->toBeEmpty()
        ->and(collect($response->headers->getCookies())->firstWhere(fn ($c) => $c->getName() === SESSION_COOKIE)->getExpiresTime())->toBe(0);

    $this->travel(119)->minutes();
    newRequest();
    $this->withCookies($cookies)->getJson('/api/v1/user')->assertOk();

    $this->travel(121)->minutes();
    newRequest();
    $this->withCookies($cookies)->getJson('/api/v1/user')->assertUnauthorized();
});
