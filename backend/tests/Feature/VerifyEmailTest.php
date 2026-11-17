<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailCode;
use App\Services\Clock\ClockInterface;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Markdown;
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

    // Greeting for an anonymous notifiable uses username from email
    $anon = Notification::route('mail', 'anonymous@example.com');
    $anonMail = $notification->toMail($anon);
    expect((string) $anonMail->render())
        ->toContain('Hi anonymous,')
        ->not->toContain('Hi Alex,');
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
