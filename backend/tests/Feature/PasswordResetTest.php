<?php

use App\Models\User;
use App\Notifications\PasswordChanged;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;

// IM-13: POST /auth/forgot-password and /auth/reset-password (AA-4, SC-05)
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
    Notification::fake();
    // The breached-password service knows nothing about these passwords, unless a test says so
    $this->breachReply = fn () => Http::response('0000000000000000000000000000000000A:3');
    Http::fake(['api.pwnedpasswords.com/*' => fn () => ($this->breachReply)()]);
    $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'old password 1']);
});

function requestReset(string $email = 'example@gmail.com', string $ip = '10.0.0.1'): TestResponse
{
    newRequest();

    return test()->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/v1/auth/forgot-password', ['email' => $email]);
}

/** The token from the last reset email, read from the link's fragment. */
function sentToken(User $user): string
{
    $token = null;
    Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $mail) use ($user, &$token) {
        $url = $mail->toMail($user)->actionUrl;
        expect($url)->toStartWith('http://localhost:3000/reset-password#');
        parse_str(parse_url($url, PHP_URL_FRAGMENT), $fragment);
        $token = $fragment['token'];

        return $fragment['email'] === $user->email;
    });

    return $token;
}

function resetPassword(string $token, string $password = 'new river 42'): TestResponse
{
    newRequest();

    return test()->postJson('/api/v1/auth/reset-password', ['token' => $token, 'email' => 'Example@gmail.com', 'password' => $password]);
}

it('T-AA-30, SEC-08: answers the same for an unknown email and only emails a real account', function () {
    requestReset('nobody@gmail.com')->assertStatus(202)->assertNoContent(202);
    Notification::assertNothingSent();

    requestReset(' Example@Gmail.com ')->assertStatus(202);
    Notification::assertSentTo($this->user, ResetPassword::class);
});

it('puts the token in the link fragment, never the path or query (AA §2.3)', function () {
    requestReset();

    expect(sentToken($this->user))->toHaveLength(64);
});

it('sets the new password, signs this device in and sends the notice email (T-AA-42)', function () {
    requestReset();

    resetPassword(sentToken($this->user))->assertOk()->assertJsonPath('user.email', 'example@gmail.com');

    expect(Hash::check('new river 42', $this->user->fresh()->password))->toBeTrue()
        ->and(DB::table('audit_events')->where('user_id', $this->user->id)->pluck('event')->all())->toBe(['reset_requested', 'reset_used']);
    $this->assertAuthenticatedAs($this->user->fresh(), 'web');
    Notification::assertSentTo($this->user, PasswordChanged::class);
});

it('SEC-09: the link works once', function () {
    requestReset();
    $token = sentToken($this->user);

    resetPassword($token)->assertOk();
    resetPassword($token, 'another river 7')->assertStatus(422)->assertJsonPath('error.code', 'auth.reset_expired');
});

it('T-AA-31, SEC-09: the link expires after 60 minutes', function () {
    requestReset();
    $token = sentToken($this->user);

    $this->travel(61)->minutes();
    resetPassword($token)->assertStatus(422)->assertJsonPath('error.code', 'auth.reset_expired');
});

it('AA-E4: a new request replaces the old link', function () {
    requestReset();
    $first = sentToken($this->user);
    $this->travel(46)->seconds();
    Notification::fake();
    requestReset();
    $second = sentToken($this->user);

    resetPassword($first)->assertStatus(422);
    resetPassword($second)->assertOk();
});

it('sends nothing for a resend within 45 s, but still answers 202', function () {
    requestReset();
    Notification::fake();

    requestReset()->assertStatus(202);
    Notification::assertNothingSent();
});

it('SC-05: ends every other session, Remember me included', function () {
    // Another device, signed in with Remember me
    $other = carryCookies($this->get('/sanctum/csrf-cookie'));
    newRequest();
    $login = $this->withCookies($other)->postJson('/api/v1/auth/login', ['email' => 'example@gmail.com', 'password' => 'old password 1', 'remember' => true])->assertOk();
    $other = carryCookies($login) + $other;
    $rememberToken = $this->user->fresh()->getRememberToken();

    // This device: a fresh browser with none of the other device's cookies
    $this->defaultCookies = [];
    $this->unencryptedCookies = [];
    requestReset();
    $thisDevice = resetPassword(sentToken($this->user))->assertOk();
    expect(carryCookies($thisDevice)[SESSION_COOKIE])->not->toBe($other[SESSION_COOKIE]);

    newRequest();
    $this->withCookies($other)->getJson('/api/v1/user')->assertUnauthorized();
    expect($this->user->fresh()->getRememberToken())->not->toBe($rememberToken);
});

it('applies the sign-up password rules and the breached check', function () {
    requestReset();
    $token = sentToken($this->user);

    resetPassword($token, 'short')->assertStatus(422)->assertJsonPath('error.fields.password.0', 'At least 8 characters, and not your email.');
    resetPassword($token, 'EXAMPLE@gmail.com')->assertStatus(422)->assertJsonPath('error.fields.password.0', "Your password can't be your email.");

    $suffix = substr(strtoupper(sha1('new river 42')), 5);
    $this->breachReply = fn () => Http::response("{$suffix}:9");
    resetPassword($token)->assertStatus(422)->assertJsonPath('error.code', 'auth.password_breached');
});

it('allows 3 requests per hour per email and 10 per IP', function () {
    foreach (range(1, 3) as $i) {
        requestReset('example@gmail.com', "10.0.1.{$i}")->assertStatus(202);
    }
    requestReset('example@gmail.com', '10.0.1.9')->assertStatus(429);

    foreach (range(1, 10) as $i) {
        requestReset("user{$i}@gmail.com", '10.0.2.1')->assertStatus(202);
    }
    requestReset('another@gmail.com', '10.0.2.1')->assertStatus(429)->assertJsonPath('error.code', 'error.rate_limited');
});

it('checks the token before anything else: a bad link never reaches the breach service', function () {
    requestReset();
    Http::fake();

    resetPassword('not-the-token', 'short')->assertStatus(422)->assertJsonPath('error.code', 'auth.reset_expired');
    resetPassword('not-the-token')->assertStatus(422)->assertJsonPath('error.code', 'auth.reset_expired');
    Http::assertNothingSent();
});

it('allows 5 reset tries per minute per IP', function () {
    foreach (range(1, 5) as $i) {
        resetPassword("guess-{$i}")->assertStatus(422);
    }

    resetPassword('guess-6')->assertStatus(429)->assertJsonPath('error.code', 'error.rate_limited');
});
