<?php

declare(strict_types=1);

namespace App\Services\Push;

use App\Jobs\SendReminderPushes;
use App\Models\Project;
use App\Models\PushSubscription;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use DateTimeZone;
use GuzzleHttp\Psr7\HttpFactory;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Sends claimed reminders to every device of their users (TK §2.5).
 * - A task done, deleted or moved since the claim, or a reminder over `late_minutes` late, is
 *   not sent.
 * - Each push says how long it may wait (TTL, to the end of the late window), that it's urgent,
 *   and its task (Topic), so a push service holding a stale one replaces it rather than adding.
 * - 404/410: the device unsubscribed, so its subscription goes. 429, 5xx and network errors are
 *   tried again for those devices only, `retries` times; other answers are logged, not retried.
 */
class ReminderSender
{
    public function __construct(
        private readonly VapidKeys $keys,
        private readonly PushClient $client,
        private readonly ClockInterface $clock,
    ) {}

    /**
     * @param  list<array{task_id: string, remind_at: string}>  $deliveries
     * @param  list<string>|null  $onlyEndpoints  a retry: just these devices
     */
    public function send(array $deliveries, int $attempt = 0, ?array $onlyEndpoints = null): void
    {
        if ($deliveries === [] || ! $this->keys->configured()) {
            return;
        }
        $now = $this->clock->now()->setTimezone(new DateTimeZone('UTC'));
        $oldest = $now->modify('-'.(int) config('push.late_minutes').' minutes');

        $tasks = Task::query()->whereIn('id', array_column($deliveries, 'task_id'))->get()->keyBy('id');
        $userIds = $tasks->pluck('user_id')->unique()->values()->all();
        $timeFormats = User::query()->whereIn('id', $userIds)->pluck('time_format', 'id');
        $projects = Project::query()->whereIn('id', $tasks->pluck('project_id')->filter()->unique()->values()->all())->pluck('name', 'id');
        $devices = PushSubscription::query()->whereIn('user_id', $userIds)
            ->when($onlyEndpoints !== null, fn ($q) => $q->whereIn('endpoint', $onlyEndpoints ?? []))
            ->get()->groupBy('user_id');

        $encoder = new PushEncoder($this->keys->auth(), [], $this->client->client(), new HttpFactory, new HttpFactory);
        /** @var list<array{delivery: array{task_id: string, remind_at: string}, endpoint: string, request: RequestInterface}> $outgoing */
        $outgoing = [];
        foreach ($deliveries as $delivery) {
            $task = $tasks->get($delivery['task_id']);
            $remindAt = new DateTimeImmutable($delivery['remind_at']);
            if (! $task instanceof Task || $task->done || $remindAt <= $oldest || ! $this->stillDue($task, $remindAt)) {
                continue;
            }
            $message = ReminderMessage::for($task, $task->project_id ? $projects->get($task->project_id) : null, (string) ($timeFormats->get($task->user_id) ?? '24h'));
            $options = [
                'TTL' => max(60, $remindAt->getTimestamp() + (int) config('push.late_minutes') * 60 - $now->getTimestamp()),
                'urgency' => 'high',
                'topic' => substr(hash('sha256', (string) $task->id), 0, 32),
            ];
            foreach ($devices->get($task->user_id, collect()) as $device) {
                $request = $this->encrypt($encoder, $device, (string) json_encode($message), $options);
                if ($request !== null) {
                    $outgoing[] = ['delivery' => $delivery, 'endpoint' => $device->endpoint, 'request' => $request];
                }
            }
        }

        $results = $this->client->sendAll(array_column($outgoing, 'request'));
        $this->settle($encoder, $outgoing, $results, $attempt);
    }

    private function stillDue(Task $task, DateTimeImmutable $remindAt): bool
    {
        $current = $task->getAttribute('remind_at');

        return $current instanceof \DateTimeInterface && $current->getTimestamp() === $remindAt->getTimestamp();
    }

    /**
     * One notification at a time, so one broken subscription can't stop the others.
     *
     * @param  array<string, mixed>  $options
     */
    private function encrypt(PushEncoder $encoder, PushSubscription $device, string $payload, array $options): ?RequestInterface
    {
        try {
            $encoder->queueNotification(Subscription::create([
                'endpoint' => $device->endpoint,
                'publicKey' => $device->keys['p256dh'] ?? '',
                'authToken' => $device->keys['auth'] ?? '',
                'contentEncoding' => 'aes128gcm',
            ]), $payload, $options);

            return $encoder->takeRequests()[0] ?? null;
        } catch (\Throwable $e) {
            Log::warning('reminders.encrypt_failed', ['subscription' => $device->id, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @param  list<array{delivery: array{task_id: string, remind_at: string}, endpoint: string, request: RequestInterface}>  $outgoing
     * @param  list<ResponseInterface|\Throwable>  $results
     */
    private function settle(PushEncoder $encoder, array $outgoing, array $results, int $attempt): void
    {
        $sent = 0;
        $gone = [];
        /** @var array<string, array{delivery: array{task_id: string, remind_at: string}, endpoints: list<string>}> $again */
        $again = [];
        foreach ($outgoing as $i => $item) {
            $result = $results[$i] ?? new \RuntimeException('No response');
            $report = $encoder->report($item['request'], $result);
            if ($report->isSuccess()) {
                $sent++;
            } elseif ($report->isSubscriptionExpired()) {
                $gone[] = $item['endpoint'];
            } elseif (self::temporary($result)) {
                $key = $item['delivery']['task_id'].'|'.$item['delivery']['remind_at'];
                $again[$key] ??= ['delivery' => $item['delivery'], 'endpoints' => []];
                $again[$key]['endpoints'][] = $item['endpoint'];
            } else {
                Log::warning('reminders.refused', ['status' => $result instanceof ResponseInterface ? $result->getStatusCode() : null]);
            }
        }
        if ($gone !== []) {
            PushSubscription::query()->whereIn('endpoint', $gone)->delete();
        }
        if ($again !== [] && $attempt < (int) config('push.retries')) {
            SendReminderPushes::dispatch(
                array_column($again, 'delivery'),
                $attempt + 1,
                array_values(array_unique(array_merge(...array_column($again, 'endpoints')))),
            )->delay(now()->addSeconds((int) config('push.retry_seconds') * ($attempt + 1)));
        }
        Log::info('reminders.sent', ['sent' => $sent, 'gone' => count($gone), 'again' => count($again), 'attempt' => $attempt]);
    }

    private static function temporary(ResponseInterface|\Throwable $result): bool
    {
        if ($result instanceof \Throwable) {
            return true;
        }
        $status = $result->getStatusCode();

        return $status === 429 || $status >= 500;
    }
}
