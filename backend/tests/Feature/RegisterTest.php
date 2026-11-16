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
    config(['session.driver' => 'database']);
    newRequest();
    $this->breachReply = fn () => Http::response('0000000000000000000000000000000000A:3');
    Http::fake(['api.pwnedpasswords.com/*' => fn () => ($this->breachReply)()]);
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
});

it('T-AA-101: starts a sign-up with the email trimmed and lower-cased', function () {
    $response = register(['email' => '  Example@Gmail.COM '])->assertStatus(202);

    expect($response->json())->toBe(['pending' => true, 'email' => 'example@gmail.com'])
        ->and(User::count())->toBe(0)
        ->and(DB::table('audit_events')->where('event', 'sign_up_started')->exists())->toBeTrue();
    $this->assertGuest('web');
});

it('T-AA-02: rejects passwords shorter than 8 or longer than 128 characters', function (string $password) {
    register(['password' => $password])->assertStatus(422)
        ->assertJsonPath('error.code', 'error.invalid')
        ->assertJsonPath('error.fields.password.0', "At least 8 characters, and doesn't contain your information.");
})->with(['short' => 'seven77', 'long' => str_repeat('x', 129)]);

it('AA §2.10: rejects a new password with characters an English keyboard does not type', function (string $password) {
    register(['password' => $password])->assertStatus(422)
        ->assertJsonPath('error.fields.password.0', "Can't contain special characters.");
    expect(User::count())->toBe(0);
})->with([
    'Telex mật khẩu' => 'mật khẩu 123',
    'an accented capital' => 'Quiet RÍVER 42',
    'a decomposed accent' => "quiet rive\u{0301}r 42",
    'Japanese' => 'パスワード 12345',
    'Cyrillic look-alike' => 'quiet rivеr 42',
    'a tab' => "quiet\triver 42",
]);

it('AA §2.10: accepts every English keyboard symbol and emoji with joiners, skin tones and flags', function (string $password) {
    register(['password' => $password])->assertStatus(202);
})->with([
    'symbols' => '~!@#$%^&*()_+`-={}|[]\\:";\'<>?,./ Aa1',
    'emoji sequences' => 'river 👍🏽 👩‍💻 🇻🇳 ❤️ 1️⃣',
]);

it('T-AA-03: accepts spaces, emoji and 128 characters in full', function () {
    $password = str_repeat('🙂 ab', 32);
    expect(mb_strlen($password))->toBe(128);

    register(['password' => $password])->assertStatus(202);
});

it('T-AA-108: rejects a password equal to the email, or containing its name part, in any case', function (string $password) {
    register(['password' => $password])->assertStatus(422)
        ->assertJsonPath('error.fields.password.0', "Your password can't contain your email.");
    expect(User::count())->toBe(0);
})->with(['the email' => 'EXAMPLE@gmail.com', 'the name part' => 'my Example 2026']);

it('T-AA-113: an email already in use returns the same 202 response', function () {
    User::factory()->create(['email' => 'example@gmail.com']);

    register(['email' => 'EXAMPLE@gmail.com'])->assertStatus(202)
        ->assertJson(['pending' => true, 'email' => 'example@gmail.com']);
});

it('SEC-06: rejects a breached password', function () {
    $suffix = substr(strtoupper(sha1('quiet river 42')), 5);
    $this->breachReply = fn () => Http::response("{$suffix}:120");

    register()->assertStatus(422)->assertJsonPath('error.code', 'auth.password_breached');
    expect(User::count())->toBe(0);
});

it('T-AA-110: starts the sign-up when the breach service is down', function () {
    $this->breachReply = fn () => throw new ConnectionException('down');

    register()->assertStatus(202);
});

it('SEC-08b: allows 5 different emails per hour per IP, not 5 button presses', function () {
    foreach (range(1, 5) as $i) {
        register(['email' => "user{$i}@gmail.com"])->assertStatus(202);
    }

    $blocked = register(['email' => 'user6@gmail.com'])->assertStatus(429)
        ->assertHeader('Retry-After')->assertJsonPath('error.code', 'auth.signup_limited');
    expect($blocked->json('error.retry_after'))->toBeGreaterThan(3500)->toBeLessThanOrEqual(3600);

    // An email already tried this hour still answers, and costs nothing more
    register(['email' => 'user1@gmail.com'])->assertStatus(202);
});

it('SEC-08b: pressing Create account many times for 2 emails never reaches the hourly limit', function () {
    // One browser (one session) per email, each pressing the button 12 times
    foreach (['one@gmail.com', 'two@gmail.com'] as $email) {
        $cookies = carryCookies(test()->get('/sanctum/csrf-cookie'));
        foreach (range(1, 12) as $press) {
            newRequest();
            $response = test()->withCookies($cookies)->postJson('/api/v1/auth/register', [
                'email' => $email, 'password' => 'quiet river 42', 'timezone' => 'Asia/Ho_Chi_Minh',
            ])->assertStatus(202);
            $cookies = carryCookies($response) + $cookies;
        }
    }
    // Still room for three more different emails
    foreach (range(3, 5) as $i) {
        register(['email' => "user{$i}@gmail.com"])->assertStatus(202);
    }
});

it('SEC-08b: a refused sign-up (weak or breached password) does not use up one of the 5', function () {
    foreach (range(1, 8) as $i) {
        register(['email' => "weak{$i}@gmail.com", 'password' => 'short'])->assertStatus(422);
    }
    foreach (range(1, 5) as $i) {
        register(['email' => "user{$i}@gmail.com"])->assertStatus(202);
    }
});

it('SEC-08b: the press limit is 30 per 10 minutes per IP, the usual sign-in range', function () {
    foreach (range(1, 30) as $i) {
        register(['email' => 'one@gmail.com'])->assertStatus(202);
    }

    register(['email' => 'one@gmail.com'])->assertStatus(429)->assertHeader('Retry-After');
});
