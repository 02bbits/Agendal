<?php

use App\Models\User;
use App\Notifications\PasswordChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
    Notification::fake();
    $this->breachReply = fn () => Http::response('0000000000000000000000000000000000A:3');
    Http::fake(['api.pwnedpasswords.com/*' => fn () => ($this->breachReply)()]);
    $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'old password 1']);
});

if (! function_exists('asDevice')) {
    function asDevice(array $cookies = []): TestCase
    {
        newRequest();
        (fn () => $this->defaultCookies = $this->unencryptedCookies = [])->call(test()->target);

        return test()->withCookies($cookies);
    }
}

function signInDevice(string $email = 'example@gmail.com', string $password = 'old password 1'): array
{
    $cookies = carryCookies(asDevice()->get('/sanctum/csrf-cookie'));
    $login = asDevice($cookies)->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password, 'remember' => true])->assertOk();

    return carryCookies($login) + $cookies;
}

it('returns 401 when signed out', function () {
    asDevice()->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'new password 1',
        'password_confirmation' => 'new password 1',
    ])->assertUnauthorized();
});

it('fails with 422 on current_password when wrong and leaves password unchanged', function () {
    $device = signInDevice();
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'wrong password',
        'password' => 'new password 1',
        'password_confirmation' => 'new password 1',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.current_password_wrong')
        ->assertJsonPath('error.fields.current_password.0', "That's not your current password.");

    expect(Hash::check('old password 1', $this->user->fresh()->password))->toBeTrue();
});

it('AA §2.10: rejects a new password with accented letters and keeps the old one', function () {
    $device = signInDevice();
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'mật khẩu mới 1',
        'password_confirmation' => 'mật khẩu mới 1',
    ])->assertStatus(422)
        ->assertJsonPath('error.fields.password.0', "Can't contain special characters.");

    expect(Hash::check('old password 1', $this->user->fresh()->password))->toBeTrue();
});

it('validates each password rule and breach check', function () {
    $device = signInDevice();

    // Short password
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertStatus(422)->assertJsonPath('error.fields.password.0', "At least 8 characters, and doesn't contain your information.");

    // Same as email
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'example@gmail.com',
        'password_confirmation' => 'example@gmail.com',
    ])->assertStatus(422)->assertJsonPath('error.fields.password.0', "Your password can't contain your email.");

    // Same as current
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'old password 1',
        'password_confirmation' => 'old password 1',
    ])->assertStatus(422)->assertJsonPath('error.code', 'auth.password_same_as_current');

    // Mismatch
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'new password 1',
        'password_confirmation' => 'different password 1',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.password_mismatch')
        ->assertJsonPath('error.fields.password_confirmation.0', "New passwords don't match.");

    // Breached
    $suffix = substr(strtoupper(sha1('breached password 1')), 5);
    $this->breachReply = fn () => Http::response("{$suffix}:9");
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'breached password 1',
        'password_confirmation' => 'breached password 1',
    ])->assertStatus(422)->assertJsonPath('error.code', 'auth.password_breached');
});

it('successfully changes the password, keeps this session, ends other sessions, notifies and audits', function () {
    $other = signInDevice();
    $thisDevice = signInDevice();
    $tokenBefore = $this->user->fresh()->getRememberToken();

    $response = asDevice($thisDevice)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'new password 42',
        'password_confirmation' => 'new password 42',
    ])->assertOk()->assertJsonPath('user.email', 'example@gmail.com');

    $updatedCookies = carryCookies($response) + $thisDevice;

    expect(Hash::check('new password 42', $this->user->fresh()->password))->toBeTrue()
        ->and($this->user->fresh()->getRememberToken())->not->toBe($tokenBefore)
        ->and(DB::table('audit_events')->where('user_id', $this->user->id)->where('event', 'password_changed')->count())->toBe(1);

    Notification::assertSentTo($this->user, PasswordChanged::class);

    // This session is still valid
    asDevice($updatedCookies)->getJson('/api/v1/me')->assertOk();

    // Other session was deleted
    asDevice($other)->getJson('/api/v1/me')->assertUnauthorized();
});

it('returns 401 on check-password when signed out', function () {
    asDevice()->postJson('/api/v1/auth/check-password', [
        'current_password' => 'old password 1',
    ])->assertUnauthorized();
});

it('checks current password returning 204 when correct and 422 when wrong or invalid', function () {
    $device = signInDevice();

    asDevice($device)->postJson('/api/v1/auth/check-password', [
        'current_password' => 'wrong password',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.current_password_wrong')
        ->assertJsonPath('error.fields.current_password.0', "That's not your current password.");

    asDevice($device)->postJson('/api/v1/auth/check-password', [
        'current_password' => '',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'error.invalid');

    asDevice($device)->postJson('/api/v1/auth/check-password', [
        'current_password' => 'old password 1',
    ])->assertNoContent();
});

// Replaces the old "throttles attempts after 5 per 15 minutes" test (old "6th attempt is 429" test).
it('throttles after 5 wrong tries across check and change, then returns 429 even with correct password with Retry-After set', function () {
    $device = signInDevice();

    // 3 wrong check-password tries
    foreach (range(1, 3) as $i) {
        asDevice($device)->postJson('/api/v1/auth/check-password', [
            'current_password' => 'wrong-pass-'.$i,
        ])->assertStatus(422);
    }

    // 2 wrong change-password tries (total 5 wrong tries)
    foreach (range(4, 5) as $i) {
        asDevice($device)->postJson('/api/v1/auth/change-password', [
            'current_password' => 'wrong-pass-'.$i,
            'password' => 'new password 42',
            'password_confirmation' => 'new password 42',
        ])->assertStatus(422);
    }

    // 6th attempt (even with right password) is 429 with Retry-After header set
    $response = asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'new password 42',
        'password_confirmation' => 'new password 42',
    ])->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited')
        ->assertHeader('Retry-After');

    expect($response->headers->get('Retry-After'))->not->toBeNull();

    // check-password also returns 429
    asDevice($device)->postJson('/api/v1/auth/check-password', [
        'current_password' => 'old password 1',
    ])->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited')
        ->assertHeader('Retry-After');
});

it('clears rate limiter on a correct password check', function () {
    $device = signInDevice();

    // 4 wrong attempts
    foreach (range(1, 4) as $i) {
        asDevice($device)->postJson('/api/v1/auth/check-password', [
            'current_password' => 'wrong-pass-'.$i,
        ])->assertStatus(422);
    }

    // A correct check clears the counter
    asDevice($device)->postJson('/api/v1/auth/check-password', [
        'current_password' => 'old password 1',
    ])->assertNoContent();

    // Now user has 5 fresh wrong tries available without 429
    foreach (range(1, 4) as $i) {
        asDevice($device)->postJson('/api/v1/auth/check-password', [
            'current_password' => 'wrong-pass-again-'.$i,
        ])->assertStatus(422);
    }
});
