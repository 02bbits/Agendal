<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\SignUpAttempted;
use App\Notifications\VerifyEmailCode;
use App\Services\Clock\ClockInterface;
use App\Support\NewPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Markdown;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RateLimitedClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->clock = new RateLimitedClock('2026-11-12T10:00:00+00:00');
    $this->app->instance(ClockInterface::class, $this->clock);
    Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response('0000000000000000000000000000000000A:3')]);
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
});

it('1. register answers 202, creates no user, signs nobody in, and emails the code to an anonymous route', function () {
    Notification::fake();

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $response = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => '  NewUser@Example.com  ',
        'password' => 'Quiet river 42',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertStatus(202)
        ->assertExactJson(['pending' => true, 'email' => 'newuser@example.com']);

    expect(User::count())->toBe(0)
        ->and(Auth::guard('web')->check())->toBeFalse()
        ->and(DB::table('audit_events')->where('event', 'sign_up_started')->exists())->toBeTrue()
        ->and(DB::table('audit_events')->whereNotNull('user_id')->exists())->toBeFalse();

    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n, array $channels, $notifiable) {
        return $notifiable instanceof AnonymousNotifiable
            && ($notifiable->routes['mail'] ?? null) === 'newuser@example.com'
            && preg_match('/^\d{6}$/', $n->code) === 1;
    });
});

it('2. GET /auth/signup returns email, right code creates verified user and audits, original password signs in', function () {
    Notification::fake();

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'verified@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertStatus(202);
    $cookies = carryCookies($reg) + $cookies;

    $capturedCode = '';
    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n) use (&$capturedCode) {
        $capturedCode = $n->code;

        return true;
    });

    newRequest();
    $this->withCookies($cookies)->getJson('/api/v1/auth/signup')
        ->assertOk()
        ->assertExactJson(['email' => 'verified@example.com']);

    newRequest();
    $verifyRes = $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', [
        'code' => $capturedCode,
    ])->assertOk();
    $cookies = carryCookies($verifyRes) + $cookies;

    $user = User::sole();
    expect($user->email)->toBe('verified@example.com')
        ->and($user->display_name)->toBe('verified')
        ->and($user->timezone)->toBe('Asia/Ho_Chi_Minh')
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(DB::table('audit_events')->where(['user_id' => $user->id, 'event' => 'sign_up'])->exists())->toBeTrue()
        ->and(DB::table('audit_events')->where(['user_id' => $user->id, 'event' => 'email_verified'])->exists())->toBeTrue();

    $this->assertAuthenticatedAs($user, 'web');

    Auth::guard('web')->logout();
    newRequest();

    $this->withCookies($cookies)->postJson('/api/v1/auth/login', [
        'email' => 'verified@example.com',
        'password' => 'Quiet river 42',
    ])->assertOk();

    $this->assertAuthenticatedAs($user, 'web');
});

it('3. four wrong codes fail, 5th dies, right code after dies, resend 60 s later gives working code', function () {
    Notification::fake();

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'tries@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    $cookies = carryCookies($reg) + $cookies;

    $firstCode = '';
    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n) use (&$firstCode) {
        $firstCode = $n->code;

        return true;
    });

    foreach (range(1, 4) as $i) {
        newRequest();
        $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => '000000'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'auth.verify_wrong');
    }

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => '000000'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many');

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => $firstCode])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many');

    $this->clock->advance('+60 seconds');

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/resend')->assertNoContent();

    $newCode = '';
    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n) use (&$newCode, $firstCode) {
        if ($n->code !== $firstCode) {
            $newCode = $n->code;
        }

        return true;
    });

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => $newCode])
        ->assertOk();
    expect(User::count())->toBe(1);
});

it('4. resend right away returns 429, ten codes trigger 30-min wait, registering during wait returns 429', function () {
    Notification::fake();

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'ratelimit@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    $cookies = carryCookies($reg) + $cookies;

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');

    $this->clock->advance('+60 seconds');
    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/resend')->assertNoContent();

    // 8 more resends (making 10 codes total)
    foreach (range(3, 10) as $i) {
        $this->clock->advance('+60 seconds');
        newRequest();
        $this->withCookies($cookies)->postJson('/api/v1/auth/signup/resend')->assertNoContent();
    }

    $this->clock->advance('+60 seconds');
    newRequest();
    $blocked = $this->withCookies($cookies)->postJson('/api/v1/auth/signup/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');
    expect((int) $blocked->json('error.retry_after'))->toBeGreaterThan(1700);

    newRequest();
    $regBlocked = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'ratelimit@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(429);
    expect((int) $regBlocked->json('error.retry_after'))->toBeGreaterThan(1700);
});

it('5. after 30 minutes signup expires (404 and 422), creating no user', function () {
    Notification::fake();

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'expired@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    $cookies = carryCookies($reg) + $cookies;

    $code = '';
    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n) use (&$code) {
        $code = $n->code;

        return true;
    });

    $this->clock->advance('+1801 seconds');

    newRequest();
    $this->withCookies($cookies)->getJson('/api/v1/auth/signup')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'auth.signup_expired');

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => $code])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.signup_expired');

    expect(User::count())->toBe(0);
});

it('6. registering again with the same email replaces the waiting signup', function () {
    Notification::fake();

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg1 = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'replace@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    $cookies = carryCookies($reg1) + $cookies;

    $oldCode = '';
    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n) use (&$oldCode) {
        $oldCode = $n->code;

        return true;
    });

    $this->clock->advance('+10 seconds');

    newRequest();
    $reg2 = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'replace@example.com',
        'password' => 'Quiet river 99',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    $cookies = carryCookies($reg2) + $cookies;

    $newCode = '';
    Notification::assertSentOnDemand(VerifyEmailCode::class, function (VerifyEmailCode $n) use (&$newCode, $oldCode) {
        if ($n->code !== $oldCode) {
            $newCode = $n->code;
        }

        return true;
    });

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => $oldCode])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_wrong');

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => $newCode])
        ->assertOk();

    expect(User::sole()->email)->toBe('replace@example.com');
});

it('7. existing email answers same 202 shape, sends SignUpAttempted once, codes fail, existing user untouched', function () {
    Notification::fake();

    $existing = User::factory()->create([
        'email' => 'taken@example.com',
        'password' => 'Original secret 123',
        'display_name' => 'Existing Person',
        'email_verified_at' => now(),
    ]);

    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'taken@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202)
        ->assertExactJson(['pending' => true, 'email' => 'taken@example.com']);
    $cookies = carryCookies($reg) + $cookies;

    Notification::assertNothingSentTo(new AnonymousNotifiable, VerifyEmailCode::class);
    Notification::assertSentTo($existing, SignUpAttempted::class);

    // Second register within 30 minutes sends no second notification
    Notification::fake();
    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'taken@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    Notification::assertNothingSent();

    foreach (range(1, 4) as $i) {
        newRequest();
        $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => '000000'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'auth.verify_wrong');
    }

    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/verify', ['code' => '000000'])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many');

    $this->clock->advance('+60 seconds');
    newRequest();
    $this->withCookies($cookies)->postJson('/api/v1/auth/signup/resend')->assertNoContent();
    Notification::assertNothingSent();

    $fresh = $existing->fresh();
    expect(Hash::check('Original secret 123', $fresh->password))->toBeTrue()
        ->and($fresh->display_name)->toBe('Existing Person');
});

it('8. password strength rejects weak passwords and NewPassword::strength matches expectations', function () {
    $this->postJson('/api/v1/auth/register', [
        'email' => 'weak1@example.com',
        'password' => 'quietriver',
        'timezone' => 'UTC',
    ])->assertStatus(422)
        ->assertJsonPath('error.fields.password.0', NewPassword::WEAK);

    $this->postJson('/api/v1/auth/register', [
        'email' => 'weak2@example.com',
        'password' => 'quietriver12',
        'timezone' => 'UTC',
    ])->assertStatus(422)
        ->assertJsonPath('error.fields.password.0', NewPassword::WEAK);

    $this->postJson('/api/v1/auth/register', [
        'email' => 'strong@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);

    expect(NewPassword::strength(''))->toBe(0)
        ->and(NewPassword::strength('abcdefg'))->toBe(0)
        ->and(NewPassword::strength('abcdefgh'))->toBe(1)
        ->and(NewPassword::strength('abcdefghijkl'))->toBe(2)
        ->and(NewPassword::strength('Abcdefgh1!'))->toBe(2)
        ->and(NewPassword::strength('Abcdefghijk1!'))->toBe(3)
        ->and(NewPassword::strength('Abcdefghijklmno1!'))->toBe(4)
        ->and(NewPassword::strength('🙂🙂🙂🙂aaaa'))->toBe(1);
});

it('9. DELETE /auth/signup cancels and then GET /auth/signup answers 404', function () {
    $csrf = $this->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $reg = $this->withCookies($cookies)->postJson('/api/v1/auth/register', [
        'email' => 'cancel@example.com',
        'password' => 'Quiet river 42',
        'timezone' => 'UTC',
    ])->assertStatus(202);
    $cookies = carryCookies($reg) + $cookies;

    newRequest();
    $this->withCookies($cookies)->getJson('/api/v1/auth/signup')->assertOk();

    newRequest();
    $this->withCookies($cookies)->deleteJson('/api/v1/auth/signup')->assertNoContent();

    newRequest();
    $this->withCookies($cookies)->getJson('/api/v1/auth/signup')->assertStatus(404);
});

it('10. renders the account creation attempt notice email properly in HTML and text without buttons or subcopy', function () {
    $user = User::factory()->create([
        'email' => 'tuanno@example.com',
        'display_name' => 'Tuấn Hồ',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ]);

    $notification = new SignUpAttempted(ip: '192.168.1.100', time: 'Nov 15, 2026, 10:30 AM +07');
    $mail = $notification->toMail($user);

    expect($mail->subject)->toBe('[Agendal] Security notice: Account creation attempt');

    $html = (string) $mail->render();
    $text = (string) app(Markdown::class)->renderText($mail->markdown, $mail->data());

    expect($html)
        ->toContain('Account creation attempt')
        ->toContain('Hi Tuấn Hồ,')
        ->toContain('192.168.1.100')
        ->toContain('Nov 15, 2026, 10:30 AM +07')
        ->toContain('sign in')
        ->toContain('reset your password')
        ->not->toContain('<table class="action"')
        ->not->toContain('If the button doesn\'t work')
        ->not->toContain('class="button');

    expect($text)
        ->toContain('Account creation attempt')
        ->toContain('Hi Tuấn Hồ,')
        ->toContain('192.168.1.100')
        ->not->toContain('If the button doesn\'t work');
});
