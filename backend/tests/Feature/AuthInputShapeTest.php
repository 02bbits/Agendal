<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

// PR #153 security review: a field sent as a list or object answers 422, never a 500
uses(RefreshDatabase::class);

// A request from the app, so the session-only endpoints run (ADR-007)
beforeEach(function () {
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
});

it('answers 422 to a list where the public auth endpoints expect text', function (string $path, array $body) {
    $this->postJson($path, $body)->assertStatus(422);
})->with([
    'register password' => ['/api/v1/auth/register', ['email' => 'probe@gmail.com', 'password' => ['a', 'b'], 'timezone' => 'UTC']],
    'register email' => ['/api/v1/auth/register', ['email' => ['probe@gmail.com'], 'password' => 'quiet river 42', 'timezone' => 'UTC']],
    'login email' => ['/api/v1/auth/login', ['email' => ['probe@gmail.com'], 'password' => 'quiet river 42']],
    'forgot email' => ['/api/v1/auth/forgot-password', ['email' => ['probe@gmail.com']]],
    'reset email' => ['/api/v1/auth/reset-password', ['token' => 'abc', 'email' => ['probe@gmail.com'], 'password' => 'quiet river 42']],
    'reset token' => ['/api/v1/auth/reset-password', ['token' => ['abc'], 'email' => 'probe@gmail.com', 'password' => 'quiet river 42']],
    'reset password' => ['/api/v1/auth/reset-password', ['token' => 'abc', 'email' => 'probe@gmail.com', 'password' => ['a']]],
    'two-factor code' => ['/api/v1/auth/two-factor/challenge', ['code' => ['123456']]],
]);

it('answers 422 to a list where the signed-in auth endpoints expect text', function (string $path, array $body) {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user, 'web')->postJson($path, $body)->assertStatus(422);
})->with([
    'change password' => ['/api/v1/auth/change-password', ['current_password' => 'password', 'password' => ['a']]],
    'check password' => ['/api/v1/auth/check-password', ['current_password' => ['a']]],
    'two-factor off' => ['/api/v1/auth/two-factor', ['enabled' => false, 'current_password' => ['a']]],
    'verify code' => ['/api/v1/auth/verify-email', ['code' => ['123456']]],
]);

it('refuses an oversized reset token or current password before hashing it', function (string $path, array $body, bool $signedIn) {
    if ($signedIn) {
        $this->actingAs(User::factory()->create(['email_verified_at' => now()]), 'web');
    }

    $this->postJson($path, $body)->assertStatus(422);
})->with([
    'reset token' => ['/api/v1/auth/reset-password', ['token' => str_repeat('a', 300), 'email' => 'probe@gmail.com', 'password' => 'quiet river 42'], false],
    'two-factor off' => ['/api/v1/auth/two-factor', ['enabled' => false, 'current_password' => str_repeat('a', 129)], true],
]);
