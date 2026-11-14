<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailCode;
use App\Services\Clock\ClockInterface;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Support\RateLimitedClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->clock = new RateLimitedClock('2026-11-12T10:00:00+00:00');
    $this->app->instance(ClockInterface::class, $this->clock);
    Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response('0000000000000000000000000000000000A:3')]);
});

it('renders the verification code email properly in HTML and plain text', function () {
    $notification = new VerifyEmailCode('123456');
    $user = User::factory()->unverified()->make(['display_name' => 'Alex', 'email' => 'alex@example.com']);
    $mail = $notification->toMail($user);

    expect($mail->subject)->toBe('Your Agendal verification code');

    $html = (string) $mail->render();
    $text = (string) app(Markdown::class)->renderText($mail->markdown, $mail->data());

    expect($html)
        ->toContain('<title>'.__('email.verify_heading').'</title>')
        ->toContain('font-size: 32px')
        ->toContain('letter-spacing: 8px')
        ->toContain('123456')
        ->toContain('It works for 10 minutes.')
        ->toContain('Hi Alex,')
        ->not->toContain('Laravel')
        ->not->toContain('Regards');

    expect($text)
        ->toContain('123456')
        ->toContain('It works for 10 minutes.')
        ->toContain('Hi Alex,')
        ->not->toContain('Laravel')
        ->not->toContain('Regards');
});

it('register sends a verification code notification', function () {
    Notification::fake();

    $response = $this->postJson('/api/v1/auth/register', [
        'email' => 'newuser@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    expect($response->json('user.email_verified_at'))->toBeNull();

    /** @var User $user */
    $user = User::where('email', 'newuser@example.com')->firstOrFail();

    Notification::assertSentTo($user, VerifyEmailCode::class, function (VerifyEmailCode $notification) {
        return preg_match('/^\d{6}$/', $notification->code) === 1;
    });
});

it('verifies user with the right code and returns the verified user', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'alice@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'alice@example.com')->firstOrFail();

    $code = '';
    Notification::assertSentTo($user, VerifyEmailCode::class, function (VerifyEmailCode $notification) use (&$code) {
        $code = $notification->code;

        return true;
    });

    $verifyResponse = $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
        'code' => $code,
    ])->assertOk();

    expect($verifyResponse->json('user.email_verified_at'))->not->toBeNull();
    expect($user->fresh()->email_verified_at)->not->toBeNull();
    expect(DB::table('email_verification_codes')->where('user_id', $user->id)->count())->toBe(0);

    $audit = DB::table('audit_events')->where('user_id', $user->id)->where('event', 'email_verified')->first();
    expect($audit)->not->toBeNull();
});

it('rejects invalid code format with 422 error.invalid', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
        'code' => '123',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'error.invalid');
});

it('increments attempts on wrong code and returns 422 auth.verify_wrong', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'bob@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'bob@example.com')->firstOrFail();

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
        'code' => '000000',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_wrong')
        ->assertJsonPath('error.fields.code.0', "That code isn't right. Try again.");

    $row = DB::table('email_verification_codes')->where('user_id', $user->id)->first();
    expect($row->attempts)->toBe(1);
});

it('locks out with auth.verify_too_many after 5 wrong attempts even with right code', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'charlie@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'charlie@example.com')->firstOrFail();

    $code = '';
    Notification::assertSentTo($user, VerifyEmailCode::class, function (VerifyEmailCode $notification) use (&$code) {
        $code = $notification->code;

        return true;
    });

    for ($i = 1; $i <= 4; $i++) {
        $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
            'code' => '999999',
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'auth.verify_wrong');
    }

    // 5th attempt fails with auth.verify_too_many
    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
        'code' => '999999',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many')
        ->assertJsonPath('error.fields.code.0', 'Too many tries. Send a new code.');

    $row = DB::table('email_verification_codes')->where('user_id', $user->id)->first();
    expect($row->attempts)->toBe(5);

    // Later attempt with right code now fails with auth.verify_too_many
    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
        'code' => $code,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_too_many')
        ->assertJsonPath('error.fields.code.0', 'Too many tries. Send a new code.');
});

it('returns 422 auth.verify_expired when the code has expired', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'dave@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'dave@example.com')->firstOrFail();

    $code = '';
    Notification::assertSentTo($user, VerifyEmailCode::class, function (VerifyEmailCode $notification) use (&$code) {
        $code = $notification->code;

        return true;
    });

    // Advance clock past 10 minutes
    $this->clock->advance('+11 minutes');

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', [
        'code' => $code,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'auth.verify_expired')
        ->assertJsonPath('error.fields.code.0', 'This code has expired. Send a new one.');
});

it('rate limits resend within 60s with 429 and Retry-After header', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'eve@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'eve@example.com')->firstOrFail();

    // Immediate resend within 60s
    $resendResponse = $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'error.rate_limited');

    expect($resendResponse->headers->has('Retry-After'))->toBeTrue();
    $retryAfter = (int) $resendResponse->headers->get('Retry-After');
    expect($retryAfter)->toBeGreaterThanOrEqual(1)->toBeLessThanOrEqual(60);
});

it('resend after 60s sends a new code and resets attempts', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'frank@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'frank@example.com')->firstOrFail();

    // 2 failed attempts
    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', ['code' => '000000']);
    $this->actingAs($user)->postJson('/api/v1/auth/verify-email', ['code' => '000000']);
    expect(DB::table('email_verification_codes')->where('user_id', $user->id)->value('attempts'))->toBe(2);

    // Advance clock by 60 seconds
    $this->clock->advance('+60 seconds');

    $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertNoContent();

    $row = DB::table('email_verification_codes')->where('user_id', $user->id)->first();
    expect($row->attempts)->toBe(0);
});

it('rate limits with 429 on the 11th send in 30 minutes', function () {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'email' => 'grace@example.com',
        'password' => 'super secret 123',
        'timezone' => 'UTC',
    ])->assertCreated();

    $user = User::where('email', 'grace@example.com')->firstOrFail();

    // Send 1 was on register. Send 2..10 succeed after 60s cooldown each
    for ($i = 2; $i <= 10; $i++) {
        $this->clock->advance('+60 seconds');
        $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')->assertNoContent();
    }

    // 11th send attempt within 30 minutes
    $this->clock->advance('+60 seconds');
    $this->actingAs($user)->postJson('/api/v1/auth/verify-email/resend')
        ->assertStatus(429)
        ->assertHeader('Retry-After')
        ->assertJsonPath('error.code', 'error.rate_limited');
});

it('blocks unverified user with 403 auth.email_unverified on GET /tasks but allows GET /me', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->getJson('/api/v1/me')->assertOk()->assertJson(['id' => $user->id]);

    $this->actingAs($user)->getJson('/api/v1/tasks')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'auth.email_unverified')
        ->assertJsonPath('error.message', 'Verify your email to continue.');
});

it('seed account is verified and unaffected by EnsureEmailVerified', function () {
    $this->seed(DatabaseSeeder::class);

    $user = User::where('email', 'example@gmail.com')->firstOrFail();
    expect($user->email_verified_at)->not->toBeNull();

    $this->actingAs($user)->getJson('/api/v1/tasks?view=inbox')->assertOk();
});
