<?php

declare(strict_types=1);

use App\Models\User;
use App\Notifications\PasswordChanged;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\SignInCode;
use App\Notifications\SignUpAttempted;
use App\Notifications\VerifyEmailCode;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Queue\WorkerOptions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

it('marks all five auth mail notifications as ShouldQueue with afterCommit, tries, and backoff', function () {
    $notifications = [
        new SignInCode('123456'),
        new VerifyEmailCode('654321'),
        new SignUpAttempted,
        new PasswordChanged,
        new ResetPasswordNotification('reset-token'),
    ];

    foreach ($notifications as $notification) {
        expect($notification)->toBeInstanceOf(ShouldQueue::class)
            ->and($notification->afterCommit)->toBeTrue()
            ->and($notification->tries)->toBe(3)
            ->and($notification->backoff())->toBe([10, 30, 60]);
    }
});

it('queues each mail notification instead of sending inline during the request', function () {
    Queue::fake();

    $user = User::factory()->create();

    $user->notify(new SignInCode('111222'));
    $user->notify(new SignUpAttempted);
    $user->notify(new PasswordChanged);
    $user->sendPasswordResetNotification('reset-token');
    Notification::route('mail', 'pending@example.com')->notify(new VerifyEmailCode('333444'));

    Queue::assertPushed(SendQueuedNotifications::class, 5);
});

it('never queues mail notifications when the surrounding transaction rolls back', function () {
    config([
        'queue.default' => 'database',
        'database.connections.queue_isolated' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
        ],
        'queue.connections.database.connection' => 'queue_isolated',
    ]);

    DB::connection('queue_isolated')->statement('CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at INTEGER)');

    $user = User::factory()->create();

    try {
        DB::transaction(function () use ($user): void {
            $user->notify(new SignInCode('999888'));
            $user->notify(new PasswordChanged);
            $user->sendPasswordResetNotification('reset-token');
            Notification::route('mail', 'rollback@example.com')->notify(new VerifyEmailCode('777666'));

            throw new RuntimeException('Simulated rollback');
        });
    } catch (RuntimeException) {
        // Expected
    }

    // Separate connection is untouched by pgsql rollback: 0 rows proves afterCommit() prevented queueing
    expect(DB::connection('queue_isolated')->table('jobs')->count())->toBe(0);
});

it('does not fail register, sign-in, or password change when SMTP throws during queue processing', function () {
    config(['session.driver' => 'database']);
    newRequest();
    Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response('0000000000000000000000000000000000A:3')]);

    $user = User::factory()->create([
        'password' => 'OldPassword123!',
        'two_factor_enabled' => true,
    ]);

    Mail::shouldReceive('mailer')->andThrow(new RuntimeException('SMTP connection refused'));

    // Requests succeed and queue the notification rather than failing inline
    Queue::fake();

    $csrf = $this->withHeader('Referer', (string) config('app.frontend_url'))->get('/sanctum/csrf-cookie');
    $cookies = carryCookies($csrf);

    $this->withHeader('Referer', (string) config('app.frontend_url'))
        ->withCookies($cookies)
        ->postJson('/api/v1/auth/register', [
            'email' => 'new-user-'.uniqid().'@example.com',
            'password' => 'Quiet river 42',
            'timezone' => 'Asia/Ho_Chi_Minh',
        ])->assertStatus(202);

    $this->withHeader('Referer', (string) config('app.frontend_url'))
        ->withCookies($cookies)
        ->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'OldPassword123!',
        ])->assertStatus(202);

    $this->actingAs($user)
        ->withHeader('Referer', (string) config('app.frontend_url'))
        ->postJson('/api/v1/auth/change-password', [
            'current_password' => 'OldPassword123!',
            'password' => 'Another quiet river 88',
            'password_confirmation' => 'Another quiet river 88',
        ])->assertOk();

    Queue::assertPushed(SendQueuedNotifications::class, 3);
});

it('retries queued mail notifications up to 3 times on SMTP failure and logs redacted failure automatically', function () {
    config(['queue.default' => 'database']);
    DB::table('jobs')->delete();
    DB::table('failed_jobs')->delete();

    $job = new SendQueuedNotifications(
        Notification::route('mail', 'retry@example.com'),
        new VerifyEmailCode('482910'),
        ['mail'],
    );
    Queue::connection('database')->push($job);
    expect(DB::table('jobs')->count())->toBe(1);

    Mail::shouldReceive('mailer')
        ->times(3)
        ->andThrow(new RuntimeException('SMTP connection refused for retry@example.com'));

    Log::spy();

    $worker = app('queue.worker');
    $options = new WorkerOptions(maxTries: 1, timeout: 60);

    $worker->runNextJob('database', 'default', $options);
    expect(DB::table('jobs')->count())->toBe(1)
        ->and(DB::table('failed_jobs')->count())->toBe(0);

    $this->travel(15)->seconds();
    $worker->runNextJob('database', 'default', $options);
    expect(DB::table('jobs')->count())->toBe(1)
        ->and(DB::table('failed_jobs')->count())->toBe(0);

    $this->travel(35)->seconds();
    $worker->runNextJob('database', 'default', $options);
    expect(DB::table('jobs')->count())->toBe(0);

    Log::shouldHaveReceived('warning')->once()->withArgs(function (string $message, array $context): bool {
        $serialized = json_encode($context);

        return $message === 'Queued mail notification failed.'
            && ($context['notification'] ?? null) === VerifyEmailCode::class
            && ($context['exception'] ?? null) === RuntimeException::class
            && is_string($serialized)
            && ! str_contains($serialized, 'retry@example.com')
            && ! str_contains($serialized, '482910');
    });
});
