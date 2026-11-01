<?php

use App\Models\User;
use App\Support\Audit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

// IM-15: the audit log of security events (NF-20, SEC-60)
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['session.driver' => 'database']);
    newRequest();
    $this->withHeader('Referer', 'http://localhost:3000/')->withCredentials();
    $this->user = User::factory()->create(['email' => 'example@gmail.com', 'password' => 'quiet river 42']);
});

it('SEC-60: sign-in, failure, lockout and sign-up are logged with user, IP and user agent', function () {
    $post = function (string $path, array $body) {
        newRequest();

        return test()->withServerVariables(['REMOTE_ADDR' => '10.0.0.9'])->withHeader('User-Agent', 'AuditTest/1')->postJson("/api/v1/auth/{$path}", $body);
    };
    $wrong = ['email' => 'example@gmail.com', 'password' => 'not my password'];
    foreach (range(1, 3) as $_) {
        $post('login', $wrong);
    }
    $post('register', ['email' => 'new@example.com', 'password' => 'a long fresh phrase 7', 'timezone' => 'UTC'])->assertCreated();

    $events = DB::table('audit_events')->orderBy('id')->get();
    expect($events->pluck('event')->all())->toBe(['sign_in_failed', 'sign_in_failed', 'sign_in_failed', 'lockout', 'sign_up'])
        ->and($events->every(fn ($e) => $e->ip === '10.0.0.9' && $e->user_agent === 'AuditTest/1'))->toBeTrue()
        ->and($events->first()->user_id)->toBe($this->user->id);
});

it('SEC-60: no row holds a password or a token', function () {
    newRequest();
    $this->postJson('/api/v1/auth/login', ['email' => 'example@gmail.com', 'password' => 'not my password']);
    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'example@gmail.com']);

    $dump = DB::table('audit_events')->get()->toJson();
    expect($dump)->not->toContain('not my password')->not->toContain('token')->not->toContain('quiet river 42');
});

it('SEC-60: the log is purged after 90 days, and not before', function () {
    foreach ([89, 91] as $days) {
        DB::table('audit_events')->insert(['event' => "age_{$days}", 'created_at' => now()->subDays($days)]);
    }
    $event = collect(Schedule::events())->first(fn ($e) => $e->description === 'purge-audit-events');
    expect($event)->not->toBeNull();
    $event->run(app());

    expect(DB::table('audit_events')->pluck('event')->all())->toBe(['age_89'])
        ->and(Audit::KEEP_DAYS)->toBe(90);
});
