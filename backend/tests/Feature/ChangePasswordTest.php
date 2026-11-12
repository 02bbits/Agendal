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

function asDevice(array $cookies = []): TestCase
{
    newRequest();
    (fn () => $this->defaultCookies = $this->unencryptedCookies = [])->call(test()->target);

    return test()->withCookies($cookies);
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

it('validates each password rule and breach check', function () {
    $device = signInDevice();

    // Short password
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertStatus(422)->assertJsonPath('error.fields.password.0', 'At least 8 characters, and not your email.');

    // Same as email
    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old password 1',
        'password' => 'example@gmail.com',
        'password_confirmation' => 'example@gmail.com',
    ])->assertStatus(422)->assertJsonPath('error.fields.password.0', "Your password can't be your email.");

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
    ])->assertStatus(422)->assertJsonPath('error.code', 'auth.password_mismatch');

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

it('throttles attempts after 5 per 15 minutes', function () {
    $device = signInDevice();
    foreach (range(1, 5) as $i) {
        asDevice($device)->postJson('/api/v1/auth/change-password', [
            'current_password' => 'wrong-pass',
            'password' => 'new password 42',
            'password_confirmation' => 'new password 42',
        ])->assertStatus(422);
    }

    asDevice($device)->postJson('/api/v1/auth/change-password', [
        'current_password' => 'wrong-pass',
        'password' => 'new password 42',
        'password_confirmation' => 'new password 42',
    ])->assertStatus(429);
});
