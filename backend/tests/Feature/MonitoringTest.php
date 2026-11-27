<?php

use App\Models\User;
use App\Providers\AppServiceProvider;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schedule as ScheduleFacade;
use Illuminate\Support\Str;
use Laravel\Pulse\Facades\Pulse;
use Laravel\Pulse\Livewire\Queues;
use Laravel\Pulse\PulseServiceProvider;
use Laravel\Telescope\Telescope;
use Laravel\Telescope\TelescopeServiceProvider;
use Livewire\Livewire;

// #192: Telescope behind its allow-list, keeping no user content; the slow-query alert
// #198: the Pulse dashboard, same allow-list, and the plain error pages
uses(RefreshDatabase::class);

// Telescope is off in testing (phpunit.xml), so boot it the way an enabled app does
function bootTelescope(): void
{
    config(['telescope.enabled' => true]);
    (new TelescopeServiceProvider(app()))->boot();
    app('router')->getRoutes()->refreshNameLookups();
}

// Entries left queued would be stored in the next test
afterEach(function () {
    Telescope::stopRecording();
    Telescope::flushEntries();
});

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

it('#192: outside local, Telescope records every request but not each query or cache hit', function () {
    bootTelescope();
    Telescope::startRecording();
    User::factory()->create(['email' => 'someone@example.com']);

    $this->postJson('/api/v1/auth/login', ['email' => 'someone@example.com', 'password' => 'wrong-password-1'])
        ->assertClientError(); // not a fault

    $types = DB::table('telescope_entries')->pluck('type');
    expect($types->filter(fn ($type) => $type === 'request'))->toHaveCount(1)
        ->and($types)->not->toContain('query')
        ->not->toContain('cache');
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

it('#225: a slow query posts once per window to the Discord webhook, SQL without bindings', function () {
    $file = tempnam(sys_get_temp_dir(), 'webhook');
    file_put_contents($file, " https://discord.test/api/webhooks/1/x \n");
    config(['database.slow_query_ms' => 40, 'logging.discord_alert.webhook_file' => $file]);
    Http::fake();
    $this->withoutDefer();
    Route::middleware('api')->get('api/v1/_slow', fn () => DB::select('select pg_sleep(0.05), ?::text as t', ['my private plan']));

    $first = $this->getJson('/api/v1/_slow')->assertOk();
    $this->getJson('/api/v1/_slow')->assertOk();

    Http::assertSentCount(1);
    Http::assertSent(function ($request) use ($first) {
        $embed = $request['embeds'][0];
        $fields = collect($embed['fields'])->pluck('value', 'name');

        return $request->url() === 'https://discord.test/api/webhooks/1/x'
            && $embed['title'] === 'Cảnh báo: truy vấn cơ sở dữ liệu chậm'
            && $fields['Ngưỡng'] === '40 ms'
            && $fields['Vị trí'] === '`GET /api/v1/_slow`'
            && $fields['Mã request'] === '`'.$first->headers->get('X-Request-Id').'`'
            && str_contains($fields['Câu truy vấn (không kèm giá trị)'], 'pg_sleep')
            && ! str_contains(json_encode($request->data()), 'my private plan');
    });
    unlink($file);
});

it('#225: a slow query in a queued job names the job', function () {
    $file = tempnam(sys_get_temp_dir(), 'webhook');
    file_put_contents($file, 'https://discord.test/x');
    config(['database.slow_query_ms' => 40, 'logging.discord_alert.webhook_file' => $file]);
    Http::fake();
    $this->withoutDefer();

    dispatch(new MonitoringSlowJob);

    Http::assertSent(fn ($request) => collect($request['embeds'][0]['fields'])->contains('value', '`job MonitoringSlowJob`'));
    unlink($file);
});

it('#225: without the webhook file, or when Discord fails, the request still succeeds', function (string $file) {
    config(['database.slow_query_ms' => 40, 'logging.discord_alert.webhook_file' => $file]);
    Http::fake(fn () => throw new RuntimeException('down'));
    $this->withoutDefer();
    Route::middleware('api')->get('api/v1/_slow', fn () => DB::select('select pg_sleep(0.05)'));

    $this->getJson('/api/v1/_slow')->assertOk();
})->with([
    'no file' => '',
    'webhook down' => fn () => tap(tempnam(sys_get_temp_dir(), 'webhook'), fn ($f) => file_put_contents($f, 'https://discord.test/x')),
]);

// #228: critical errors to the admins' Discord
function discordWebhookFile(): string
{
    $file = tempnam(sys_get_temp_dir(), 'webhook');
    file_put_contents($file, 'https://discord.test/x');
    config(['logging.discord_alert.webhook_file' => $file]);

    return $file;
}

/** @return list<array<string, string>> each posted embed's fields, by name */
function discordFieldsSent(): array
{
    return Http::recorded()->map(fn ($pair) => collect($pair[0]['embeds'][0]['fields'])->pluck('value', 'name')->all())->values()->all();
}

it('#228: a 500 posts its class and line once per window, never its message', function () {
    discordWebhookFile();
    Http::fake();
    $this->withoutDefer();
    Route::middleware('api')->get('api/v1/_boom/{id}', fn () => throw new RuntimeException('my private plan'));

    $first = $this->getJson('/api/v1/_boom/1')->assertStatus(500);
    $this->getJson('/api/v1/_boom/2')->assertStatus(500);

    $sent = discordFieldsSent();
    expect($sent)->toHaveCount(1)
        ->and($sent[0]['Lỗi'])->toBe('`RuntimeException`')
        ->and($sent[0]['Vị trí'])->toBe('`GET /api/v1/_boom/{id}`')
        ->and($sent[0]['Mã request'])->toBe('`'.$first->headers->get('X-Request-Id').'`')
        ->and($sent[0]['Vị trí mã nguồn'])->toStartWith('`tests/Feature/MonitoringTest.php:')
        ->and(json_encode(Http::recorded()->all()))->not->toContain('my private plan');
});

it('#228: with the database cache down, the alert still posts, throttled in the file cache', function () {
    discordWebhookFile();
    Http::fake();
    $this->withoutDefer();
    config(['cache.default' => 'database', 'cache.stores.database.connection' => 'down']);
    config(['database.connections.down' => ['driver' => 'pgsql', 'host' => '127.0.0.1', 'port' => 1, 'database' => 'x']]);
    Cache::store('file')->flush();
    Route::middleware('api')->get('api/v1/_boom', fn () => throw new RuntimeException('outage'));

    $this->getJson('/api/v1/_boom')->assertStatus(500);
    $this->getJson('/api/v1/_boom')->assertStatus(500);

    Http::assertSentCount(1);
});

it('#228: a 4xx posts nothing', function () {
    discordWebhookFile();
    Http::fake();
    $this->withoutDefer();
    Route::middleware('api')->get('api/v1/_missing', fn () => abort(404));
    Route::middleware('api')->get('api/v1/_invalid', fn () => request()->validate(['name' => 'required']));

    $this->getJson('/api/v1/_missing')->assertNotFound();
    $this->getJson('/api/v1/_invalid')->assertUnprocessable();

    Http::assertNothingSent();
});

it('#228: a failed queued job and a failed scheduled task each post their name', function () {
    discordWebhookFile();
    Http::fake();
    $this->withoutDefer();
    config(['queue.default' => 'database']);

    dispatch(new MonitoringFailingJob);
    $this->artisan('queue:work', ['--once' => true, '--tries' => 1]);
    ScheduleFacade::call(fn () => throw new LogicException('purge broke'))->everyMinute()->name('test-purge');
    $this->artisan('schedule:run');

    $sent = discordFieldsSent();
    expect($sent)->toHaveCount(2)
        ->and($sent[0]['Job'])->toBe('`MonitoringFailingJob`')
        ->and($sent[0]['Lỗi'])->toBe('`RuntimeException`')
        ->and($sent[1]['Lệnh'])->toBe('`test-purge`')
        ->and($sent[1]['Lỗi'])->toBe('`LogicException`')
        ->and(json_encode(Http::recorded()->all()))->not->toContain('broke');
});

it('#192: Telescope entries are pruned daily after 48 hours', function () {
    $prune = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains($event->command, 'telescope:prune --hours=48'));

    expect($prune)->not->toBeNull()->and($prune->expression)->toBe('0 0 * * *');
});

class MonitoringFailingJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        throw new RuntimeException('job broke');
    }
}

class MonitoringSlowJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        DB::select('select pg_sleep(0.05)');
    }
}

// Pulse is off in testing (phpunit.xml), so boot it the way an enabled app does
function bootPulse(): void
{
    config(['pulse.enabled' => true]);
    (new PulseServiceProvider(app()))->boot();
    Pulse::startRecording();
}

function pulseEntries(string $type): array
{
    Pulse::ingest();

    return DB::table('pulse_entries')->where('type', $type)->pluck('key')->all();
}

it('#198: outside local, /pulse opens only for an email on Telescope\'s allow-list', function () {
    config(['telescope.allowed_emails' => ['dev@example.com']]);

    $this->get('/pulse')->assertForbidden();
    $this->actingAs(User::factory()->create(['email' => 'someone@example.com']))->get('/pulse')->assertForbidden();
    // Behind the Next.js rewrite, Livewire must post to the public origin (APP_URL), not the API's host
    config(['app.url' => 'https://agendal.example']);
    (new AppServiceProvider(app()))->boot();
    $this->actingAs(User::factory()->create(['email' => 'dev@example.com']))->get('/pulse')->assertOk()
        ->assertSee('"uri":"https:\\/\\/agendal.example\\/livewire-', false);
});

it('#198 SC-21: a 500 shows once per place on Pulse, without its message; its log line keeps request_id', function () {
    bootPulse();
    $logged = [];
    Event::listen(MessageLogged::class, function (MessageLogged $e) use (&$logged) {
        $logged[] = Context::get('request_id');
    });
    Route::middleware('api')->get('api/v1/_boom', fn () => throw new RuntimeException('buy secretgift for anna'));

    $first = $this->getJson('/api/v1/_boom')->assertStatus(500);
    $this->getJson('/api/v1/_boom')->assertStatus(500);

    $keys = pulseEntries('exception');
    expect($keys)->toHaveCount(2)->and(array_unique($keys))->toHaveCount(1) // two hits, one row on the card
        ->and($keys[0])->toContain('RuntimeException')
        ->and(DB::table('pulse_entries')->pluck('key')->implode("\n"))->not->toContain('secretgift')
        ->and($logged)->toContain($first->headers->get('X-Request-Id'));
});

it('#198: a failed job and a failed scheduled task show on Pulse', function () {
    bootPulse();

    // Pulse skips the sync queue, so run it the way the server's worker does
    config(['queue.default' => 'database']);
    dispatch(new MonitoringFailingJob);
    $this->artisan('queue:work', ['--once' => true, '--tries' => 1]);
    ScheduleFacade::call(fn () => throw new LogicException('purge broke'))->everyMinute()->name('test-purge');
    $this->artisan('schedule:run');

    $exceptions = collect(pulseEntries('exception'));
    expect(DB::table('pulse_aggregates')->where('type', 'failed')->where('aggregate', 'count')->exists())->toBeTrue()
        ->and($exceptions->filter(fn ($key) => str_contains($key, 'RuntimeException')))->toHaveCount(1)
        ->and($exceptions->filter(fn ($key) => str_contains($key, 'LogicException')))->toHaveCount(1);
});

it('#198: a failed language-model call is counted on Pulse; the note keeps its rules result', function () {
    bootPulse();
    config(['note_llm.enabled' => true, 'note_llm.provider' => 'gemini', 'note_llm.key_file' => tap(tempnam(sys_get_temp_dir(), 'llm'), fn (string $file) => file_put_contents($file, 'test-only')), 'note_llm.prompt_version' => 'note-plan-v9']);
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => 'busy'], 500)]);

    $this->actingAs(User::factory()->create())->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'toi can mua sua',
        'written_at' => '2026-11-01T22:11:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertSuccessful()->assertJsonPath('note.engine', 'rules_fallback');

    expect(collect(pulseEntries('exception'))->filter(fn ($key) => str_contains($key, 'RequestException')))->toHaveCount(1);
});

it('#198: an error page outside the API is the plain Agendal page, styled despite the CSP', function () {
    $response = $this->get('/no-such-page')->assertNotFound()->assertSee('Not Found')->assertSee('· Agendal', false);

    expect($response->headers->get('Content-Security-Policy'))->toContain("style-src 'unsafe-inline'")->not->toContain('script-src');
});

it('#198: Pulse cards render twice under the shared database cache, which unserializes no classes', function () {
    config(['cache.default' => 'database']);
    bootPulse();
    Pulse::record('failed', 'database:default')->count()->onlyBuckets();
    Pulse::ingest();

    // The second render reads the card's cached query result
    Livewire::withoutLazyLoading()->test(Queues::class)->assertOk();
    Livewire::withoutLazyLoading()->test(Queues::class)->assertOk()->assertSee('default');
});
