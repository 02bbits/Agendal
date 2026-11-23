<?php

declare(strict_types=1);

use App\Jobs\SendReminderPushes;
use App\Models\Project;
use App\Models\PushSubscription;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Push\DueReminders;
use App\Services\Push\PushClient;
use App\Services\Push\ReminderMessage;
use App\Services\Push\ReminderSender;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Minishlink\WebPush\VAPID;
use Psr\Http\Message\RequestInterface;
use Tests\Support\FrozenClock;

// #186, TK-6, TK §2.5: claiming due reminders and sending them (T-TK-51, PERF-03)
uses(RefreshDatabase::class);

/** Records what would go to the push services and answers with a status per endpoint. */
class FakePushClient extends PushClient
{
    /** @var list<RequestInterface> */
    public array $sent = [];

    /** @var array<string, int|Throwable> */
    public array $answers = [];

    public function sendAll(array $requests): array
    {
        $this->sent = [...$this->sent, ...$requests];

        return array_map(function ($request) {
            $answer = $this->answers[(string) $request->getUri()] ?? 201;

            return $answer instanceof Throwable ? $answer : new Response($answer);
        }, $requests);
    }
}

/** A browser's subscription keys: a real P-256 public key and a 16-byte secret. */
function browserKeys(): array
{
    $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    $ec = openssl_pkey_get_details($key)['ec'];
    $b64 = fn (string $bytes) => rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');

    return ['p256dh' => $b64("\x04".$ec['x'].$ec['y']), 'auth' => $b64(random_bytes(16))];
}

function device(User $user, string $endpoint): PushSubscription
{
    return PushSubscription::query()->create(['user_id' => $user->id, 'endpoint' => $endpoint, 'keys' => browserKeys()]);
}

function reminder(User $user, string $remindAt, array $attrs = []): Task
{
    return Task::forceCreate([
        'id' => (string) Str::uuid(),
        'user_id' => $user->id,
        'title' => 'SQL quiz',
        'start_date' => '2026-10-26',
        'start_time' => '09:00',
        'reminder' => '15m',
        'remind_at' => $remindAt,
        ...$attrs,
    ]);
}

beforeEach(function () {
    $this->clock = new FrozenClock('2026-10-26T01:45:00Z'); // 08:45 in Ho Chi Minh City
    app()->instance(ClockInterface::class, $this->clock);
    $keys = VAPID::createVapidKeys();
    $file = tempnam(sys_get_temp_dir(), 'vapid');
    file_put_contents($file, $keys['privateKey']);
    config(['push.vapid.public_key' => $keys['publicKey'], 'push.vapid.private_key_file' => $file, 'push.vapid.subject' => 'mailto:team@example.com']);
    $this->push = new FakePushClient;
    app()->instance(PushClient::class, $this->push);
    $this->user = User::factory()->create();
});

describe('claiming (T-TK-51)', function () {
    it('claims a due reminder once: a second run, or a second worker, gets nothing', function () {
        $task = reminder($this->user, '2026-10-26T01:45:00Z');
        $due = app(DueReminders::class);

        $first = $due->claim($this->clock->now(), 100);
        expect($first)->toHaveCount(1)->and($first[0]['task_id'])->toBe($task->id)
            ->and($due->claim($this->clock->now(), 100))->toBe([])
            ->and(DB::table('reminder_deliveries')->count())->toBe(1);
    });

    it('skips done, deleted, not yet due and over-10-minutes-late reminders', function () {
        reminder($this->user, '2026-10-26T01:40:00Z', ['done' => true]);
        reminder($this->user, '2026-10-26T01:40:00Z', ['deleted_at' => '2026-10-26T01:00:00Z']);
        reminder($this->user, '2026-10-26T01:46:00Z');
        reminder($this->user, '2026-10-26T01:34:59Z');
        $onTime = reminder($this->user, '2026-10-26T01:35:01Z');

        $claimed = app(DueReminders::class)->claim($this->clock->now(), 100);
        expect(array_column($claimed, 'task_id'))->toBe([$onTime->id]);
    });

    it('a moved reminder (new remind_at) is claimed again, the old one is not', function () {
        $task = reminder($this->user, '2026-10-26T01:44:00Z');
        app(DueReminders::class)->claim($this->clock->now(), 100);
        $task->forceFill(['remind_at' => '2026-10-26T01:45:00Z'])->save();

        expect(app(DueReminders::class)->claim($this->clock->now(), 100))->toHaveCount(1);
    });

    it('PERF-03: 300 reminders due in one minute are claimed in one run and queued in batches, none twice', function () {
        Queue::fake();
        foreach (range(1, 300) as $i) {
            reminder($this->user, '2026-10-26T01:45:00Z', ['title' => "Task {$i}"]);
        }

        Artisan::call('reminders:send');
        Artisan::call('reminders:send');

        Queue::assertPushed(SendReminderPushes::class, 3);
        $queued = collect(Queue::pushed(SendReminderPushes::class))->flatMap(fn ($job) => array_column($job->deliveries, 'task_id'));
        expect($queued)->toHaveCount(300)->and($queued->unique())->toHaveCount(300);
    });

    it('without VAPID keys nothing is claimed, so no reminder is used up unsent', function () {
        Queue::fake();
        config(['push.vapid.private_key_file' => null]);
        reminder($this->user, '2026-10-26T01:45:00Z');

        Artisan::call('reminders:send');

        Queue::assertNothingPushed();
        expect(DB::table('reminder_deliveries')->count())->toBe(0);
    });

    it('runs every minute', function () {
        Artisan::call('schedule:list');
        expect(Artisan::output())->toContain('reminders:send')->toContain('* * * * *');
    });
});

describe('sending', function () {
    function sendDue(): void
    {
        $claimed = app(DueReminders::class)->claim(test()->clock->now(), 100);
        app(ReminderSender::class)->send($claimed);
    }

    it('sends to every device of the user, encrypted and signed, with TTL, urgency and topic', function () {
        reminder($this->user, '2026-10-26T01:45:00Z');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/phone');
        device($this->user, 'https://updates.push.services.mozilla.com/wpush/v2/laptop');
        device(User::factory()->create(), 'https://web.push.apple.com/someone-else');

        sendDue();

        expect($this->push->sent)->toHaveCount(2);
        $request = $this->push->sent[0];
        expect($request->getMethod())->toBe('POST')
            ->and($request->getHeaderLine('Content-Encoding'))->toBe('aes128gcm')
            ->and($request->getHeaderLine('Authorization'))->toStartWith('vapid t=')
            ->and($request->getHeaderLine('Urgency'))->toBe('high')
            ->and((int) $request->getHeaderLine('TTL'))->toBe(600)
            ->and($request->getHeaderLine('Topic'))->toHaveLength(32)
            ->and((string) $request->getBody())->not->toContain('SQL quiz');
    });

    it('a 404 or 410 deletes that device; the others stay', function (int $status) {
        reminder($this->user, '2026-10-26T01:45:00Z');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/gone');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/kept');
        $this->push->answers['https://fcm.googleapis.com/fcm/send/gone'] = $status;

        sendDue();

        expect(PushSubscription::query()->pluck('endpoint')->all())->toBe(['https://fcm.googleapis.com/fcm/send/kept']);
    })->with([404, 410]);

    it('a temporary failure is tried again for that device only, a limited number of times', function () {
        Queue::fake();
        $task = reminder($this->user, '2026-10-26T01:45:00Z');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/busy');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/fine');
        $this->push->answers['https://fcm.googleapis.com/fcm/send/busy'] = 503;

        sendDue();

        Queue::assertPushed(SendReminderPushes::class, fn ($job) => $job->attempt === 1
            && $job->onlyEndpoints === ['https://fcm.googleapis.com/fcm/send/busy']
            && $job->deliveries[0]['task_id'] === $task->id);

        // The last allowed try queues nothing more
        Queue::fake();
        $deliveries = [['task_id' => $task->id, 'remind_at' => '2026-10-26 01:45:00+00']];
        app(ReminderSender::class)->send($deliveries, (int) config('push.retries'), ['https://fcm.googleapis.com/fcm/send/busy']);
        Queue::assertNothingPushed();
    });

    it('a network error is temporary too; another refusal is not retried and keeps the device', function () {
        Queue::fake();
        reminder($this->user, '2026-10-26T01:45:00Z');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/offline');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/refused');
        $this->push->answers['https://fcm.googleapis.com/fcm/send/offline'] = new RuntimeException('Could not resolve host');
        $this->push->answers['https://fcm.googleapis.com/fcm/send/refused'] = 400;

        sendDue();

        Queue::assertPushed(SendReminderPushes::class, fn ($job) => $job->onlyEndpoints === ['https://fcm.googleapis.com/fcm/send/offline']);
        expect(PushSubscription::count())->toBe(2);
    });

    it('a task done or moved after the claim is not sent', function () {
        $done = reminder($this->user, '2026-10-26T01:45:00Z');
        $moved = reminder($this->user, '2026-10-26T01:45:00Z');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/phone');
        $claimed = app(DueReminders::class)->claim($this->clock->now(), 100);
        $done->forceFill(['done' => true])->save();
        $moved->forceFill(['remind_at' => '2026-10-27T01:45:00Z'])->save();

        app(ReminderSender::class)->send($claimed);

        expect($this->push->sent)->toBe([]);
    });

    it('a retry over 10 minutes late is dropped', function () {
        $task = reminder($this->user, '2026-10-26T01:45:00Z');
        device($this->user, 'https://fcm.googleapis.com/fcm/send/phone');
        app()->instance(ClockInterface::class, new FrozenClock('2026-10-26T01:55:30Z'));

        app(ReminderSender::class)->send([['task_id' => $task->id, 'remind_at' => '2026-10-26 01:45:00+00']], 1);

        expect($this->push->sent)->toBe([]);
    });
});

describe('the notification text', function () {
    it('is the title, then the day and time it counts from, then the project', function () {
        $project = Project::forceCreate(['id' => (string) Str::uuid(), 'user_id' => $this->user->id, 'name' => 'SQL Course', 'colour' => 'blue']);
        $task = reminder($this->user, '2026-10-26T01:45:00Z', ['project_id' => $project->id]);

        expect(ReminderMessage::for($task, 'SQL Course', '24h'))->toBe([
            'title' => 'SQL quiz',
            'body' => 'Mon 09:00 · SQL Course',
            'url' => "/tasks/{$task->id}",
            'tag' => "task-{$task->id}",
        ]);
    });

    it('follows the 12-hour setting, uses the due day without a start, and leaves out what is missing', function () {
        $afternoon = reminder($this->user, '2026-10-26T01:45:00Z', ['start_time' => '15:30']);
        $dueOnly = reminder($this->user, '2026-10-27T02:00:00Z', ['start_date' => null, 'start_time' => null, 'due_date' => '2026-10-27']);

        expect(ReminderMessage::for($afternoon, null, '12h')['body'])->toBe('Mon 3:30 pm')
            ->and(ReminderMessage::for($dueOnly, null, '24h')['body'])->toBe('Tue');
    });
});
