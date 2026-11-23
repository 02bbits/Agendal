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
use Illuminate\Support\Facades\Log;

/**
 * Sends claimed reminders to every device of their users (TK §2.5).
 * - A task done, deleted or moved since the claim, or a reminder over `late_minutes` late, is
 *   not sent.
 * - Each push says how long it may wait (TTL, to the end of the late window), that it's urgent,
 *   and its task (Topic), so a push service holding a stale one replaces it rather than adding.
 * - Gone devices are removed by PushSending. 429, 5xx and network errors are tried again for
 *   those devices only, `retries` times; other answers are logged, not retried.
 */
class ReminderSender
{
    public function __construct(
        private readonly VapidKeys $keys,
        private readonly PushSending $pushes,
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

        /** @var list<array{device: PushSubscription, payload: string, options: array<string, mixed>}> $outgoing */
        $outgoing = [];
        /** @var list<array{task_id: string, remind_at: string}> $forDelivery */
        $forDelivery = [];
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
                $outgoing[] = ['device' => $device, 'payload' => (string) json_encode($message), 'options' => $options];
                $forDelivery[] = $delivery;
            }
        }

        $outcomes = $this->pushes->send($outgoing);
        $this->retryTemporary($outgoing, $forDelivery, $outcomes, $attempt);
    }

    private function stillDue(Task $task, DateTimeImmutable $remindAt): bool
    {
        $current = $task->getAttribute('remind_at');

        return $current instanceof \DateTimeInterface && $current->getTimestamp() === $remindAt->getTimestamp();
    }

    /**
     * @param  list<array{device: PushSubscription, payload: string, options: array<string, mixed>}>  $outgoing
     * @param  list<array{task_id: string, remind_at: string}>  $forDelivery
     * @param  list<string>  $outcomes
     */
    private function retryTemporary(array $outgoing, array $forDelivery, array $outcomes, int $attempt): void
    {
        /** @var array<string, array{delivery: array{task_id: string, remind_at: string}, endpoints: list<string>}> $again */
        $again = [];
        foreach ($outcomes as $i => $outcome) {
            if ($outcome !== PushSending::TEMPORARY) {
                continue;
            }
            $delivery = $forDelivery[$i];
            $key = $delivery['task_id'].'|'.$delivery['remind_at'];
            $again[$key] ??= ['delivery' => $delivery, 'endpoints' => []];
            $again[$key]['endpoints'][] = $outgoing[$i]['device']->endpoint;
        }
        if ($again !== [] && $attempt < (int) config('push.retries')) {
            SendReminderPushes::dispatch(
                array_column($again, 'delivery'),
                $attempt + 1,
                array_values(array_unique(array_merge(...array_column($again, 'endpoints')))),
            )->delay(now()->addSeconds((int) config('push.retry_seconds') * ($attempt + 1)));
        }
        $counts = array_count_values($outcomes);
        Log::info('reminders.sent', [
            'sent' => $counts[PushSending::SENT] ?? 0,
            'gone' => $counts[PushSending::GONE] ?? 0,
            'again' => count($again),
            'attempt' => $attempt,
        ]);
    }
}
