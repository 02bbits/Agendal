<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

// IM-11: POST /auth/register (AA-1, AA §2.1)
uses(RefreshDatabase::class);

function register(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/auth/register', array_merge([
        'email' => 'example@gmail.com', 'password' => 'quiet river 42', 'timezone' => 'Asia/Ho_Chi_Minh',
    ], $overrides));
}

// The breached-password service answers with the hash suffixes it knows. The default never matches.
beforeEach(function () {
    $this->breachReply = fn () => Http::response('0000000000000000000000000000000000A:3');
    Http::fake(['api.pwnedpasswords.com/*' => fn () => ($this->breachReply)()]);
});

it('T-AA-101: creates the account with the email trimmed and lower-cased, signs in and returns the user', function () {
    $response = register(['email' => '  Example@Gmail.COM '])->assertCreated();

    $user = User::sole();
    expect($response->json('user'))->toMatchArray(['email' => 'example@gmail.com', 'display_name' => 'example', 'timezone' => 'Asia/Ho_Chi_Minh'])
        ->and($response->json('user'))->not->toHaveKey('password')
        ->and(Hash::info($user->password)['algoName'])->toBe('argon2id')
        ->and(DB::table('audit_events')->where('user_id', $user->id)->value('event'))->toBe('sign_up');
    $this->assertAuthenticatedAs($user, 'web');
});

it('T-AA-02: rejects passwords shorter than 8 or longer than 128 characters', function (string $password) {
    register(['password' => $password])->assertStatus(422)
        ->assertJsonPath('error.code', 'error.invalid')
        ->assertJsonPath('error.fields.password.0', 'At least 8 characters, and not your email.');
})->with(['short' => 'seven77', 'long' => str_repeat('x', 129)]);

it('T-AA-03: accepts spaces, emoji and 128 characters in full', function () {
    $password = str_repeat('🙂 ab', 32);
    expect(mb_strlen($password))->toBe(128);

    register(['password' => $password])->assertCreated();
    expect(Hash::check($password, User::sole()->password))->toBeTrue();
});

it('T-AA-108: rejects a password equal to the email in any case', function () {
    register(['password' => 'EXAMPLE@gmail.com'])->assertStatus(422)
        ->assertJsonPath('error.fields.password.0', "Your password can't be your email.");
});

it('T-AA-113: an email already in use returns auth.email_taken', function () {
    User::factory()->create(['email' => 'example@gmail.com']);

    register(['email' => 'EXAMPLE@gmail.com'])->assertStatus(422)->assertJsonPath('error.code', 'auth.email_taken');
});

it('SEC-06: rejects a breached password', function () {
    $suffix = substr(strtoupper(sha1('quiet river 42')), 5);
    $this->breachReply = fn () => Http::response("{$suffix}:120");

    register()->assertStatus(422)->assertJsonPath('error.code', 'auth.password_breached');
    expect(User::count())->toBe(0);
});

it('T-AA-110: creates the account when the breach service is down', function () {
    $this->breachReply = fn () => throw new ConnectionException('down');

    register()->assertCreated();
});

it('SEC-08b: allows 5 sign-ups per hour per IP', function () {
    foreach (range(1, 5) as $i) {
        register(['email' => "user{$i}@gmail.com"])->assertCreated();
        auth()->guard('web')->logout();
    }

    register(['email' => 'user6@gmail.com'])->assertStatus(429)
        ->assertHeader('Retry-After')->assertJsonPath('error.code', 'error.rate_limited');
});
