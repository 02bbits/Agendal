<?php

use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeServiceProvider;

// #192: Telescope behind its allow-list, keeping no user content; the slow-query alert
uses(RefreshDatabase::class);

// Telescope is off in testing (phpunit.xml), so boot it the way an enabled app does
function bootTelescope(): void
{
    config(['telescope.enabled' => true]);
    (new TelescopeServiceProvider(app()))->boot();
    app('router')->getRoutes()->refreshNameLookups();
}

afterEach(fn () => Telescope::stopRecording());

it('#192: outside local, /telescope opens only for an allow-listed email', function () {
    config(['telescope.allowed_emails' => ['dev@example.com']]);
    bootTelescope();

    $this->get('/telescope')->assertForbidden();
    $this->actingAs(User::factory()->create(['email' => 'someone@example.com']))->get('/telescope')->assertForbidden();
    $this->actingAs(User::factory()->create(['email' => 'dev@example.com']))->get('/telescope')->assertOk();
});

it('#192: locally, /telescope opens for anyone, without the API CSP that would block its scripts', function () {
    app()->detectEnvironment(fn () => 'local');
    bootTelescope();

    $response = $this->get('/telescope')->assertOk()->assertSee('<script', false);
    expect($response->headers->get('Content-Security-Policy'))->toBeNull();
});

it('#192 SC-21: Telescope entries keep no note text, password, code or email', function () {
    bootTelescope();
    Telescope::$filterUsing = []; // record everything, as locally
    Telescope::startRecording();
    $user = User::factory()->create(['email' => 'private.person@example.com', 'password' => 'my-secret-pass-1']);

    $this->actingAs($user)->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'buy secretgift for anna tomorrow',
        'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertSuccessful();
    newRequest();
    $this->postJson('/api/v1/auth/login', ['email' => 'private.person@example.com', 'password' => 'my-secret-pass-1']);
    $this->postJson('/api/v1/auth/signup/verify', ['code' => '864213']);

    $stored = DB::table('telescope_entries')->pluck('content')->implode("\n");
    expect(DB::table('telescope_entries')->where('type', 'query')->exists())->toBeTrue()
        ->and(DB::table('telescope_entries')->where('type', 'request')->count())->toBe(3)
        ->and($stored)->not->toContain('secretgift')
        ->not->toContain('my-secret-pass-1')
        ->not->toContain('864213')
        ->not->toContain('private.person');
});

it('#192: a query over the threshold logs once, with its SQL and request_id but no bindings', function () {
    config(['database.slow_query_ms' => 40]);
    $logged = [];
    Event::listen(MessageLogged::class, function (MessageLogged $e) use (&$logged) {
        if ($e->message === 'Slow query') {
            $logged[] = [$e->level, $e->context, Context::get('request_id')];
        }
    });
    Route::middleware('api')->get('api/v1/_slow', fn () => DB::select('select pg_sleep(0.05), ?::text as t', ['my private plan']));

    $response = $this->getJson('/api/v1/_slow')->assertOk();

    expect($logged)->toHaveCount(1);
    [$level, $context, $requestId] = $logged[0];
    expect($level)->toBe('error')
        ->and($context['sql'])->toContain('pg_sleep')
        ->and(json_encode($context))->not->toContain('my private plan')
        ->and($requestId)->toBe($response->headers->get('X-Request-Id'));
});

it('#192: Telescope entries are pruned daily after 48 hours', function () {
    $prune = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains($event->command, 'telescope:prune --hours=48'));

    expect($prune)->not->toBeNull()->and($prune->expression)->toBe('0 0 * * *');
});
