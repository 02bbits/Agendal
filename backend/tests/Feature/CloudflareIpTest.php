<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

// IM-65: behind the tunnel every request reaches the API from the web container, so the
// lockout (AA-3) must key on CF-Connecting-IP, and only when the deployment says so
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database', 'auth.timebox_duration' => 0]);
    $this->freezeTime();
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
    User::factory()->create(['email' => 'example@gmail.com', 'password' => 'quiet river 42']);
});

function loginVia(string $clientIp, string $password = 'quiet river 42'): TestResponse
{
    newRequest();

    // Same proxy address for everyone, as the web container would be
    return test()->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
        ->withHeader('CF-Connecting-IP', $clientIp)
        ->postJson('/api/v1/auth/login', ['email' => 'example@gmail.com', 'password' => $password]);
}

function lockOut(string $clientIp): void
{
    foreach (range(1, 3) as $i) {
        loginVia($clientIp, 'not my password')->assertStatus(422);
    }
}

it('keys the lockout on CF-Connecting-IP when trusted', function () {
    config(['app.trust_cf_connecting_ip' => true]);
    lockOut('203.0.113.7');

    loginVia('203.0.113.7')->assertStatus(429);
    loginVia('198.51.100.4')->assertOk();
});

it('ignores CF-Connecting-IP by default, so a client cannot pick its own IP', function () {
    lockOut('203.0.113.7');

    loginVia('198.51.100.4')->assertStatus(429);
});

it('ignores a CF-Connecting-IP that is not an IP', function () {
    config(['app.trust_cf_connecting_ip' => true]);
    lockOut('not-an-ip');

    loginVia('also-not-an-ip')->assertStatus(429);
});
