<?php

declare(strict_types=1);

namespace App\Services\Reminders;

use App\Models\Project;
use App\Models\PushSubscription;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Psr\Log\LoggerInterface;
use Throwable;

final class SendDueReminders
{
    public function __construct(
        private ReminderPush $push,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {}

    public function run(): int
    {
        if (! $this->push->ready()) {
            return 0;
        }

        $totalClaimed = 0;

        while (true) {
            $now = $this->clock->now();
            $tenMinutesAgo = $now->modify('-10 minutes');

            /** @var list<Task> $batch */
            $batch = DB::transaction(function () use ($now, $tenMinutesAgo): array {
                /** @var Collection<int, Task> $tasks */
                $tasks = Task::withoutGlobalScope('owner')
                    ->where('remind_at', '<=', $now)
                    ->where('remind_at', '>=', $tenMinutesAgo)
                    ->where('done', false)
                    ->whereNull('deleted_at')
                    ->whereNotExists(function ($query) {
                        $query->select(DB::raw(1))
                            ->from('reminder_deliveries')
                            ->whereColumn('reminder_deliveries.task_id', 'tasks.id')
                            ->whereColumn('reminder_deliveries.remind_at', 'tasks.remind_at');
                    })
                    ->orderBy('remind_at')
                    ->limit(100)
                    ->lock('FOR UPDATE SKIP LOCKED')
                    ->get();

                if ($tasks->isEmpty()) {
                    return [];
                }

                $claimed = [];
                foreach ($tasks as $task) {
                    $inserted = DB::table('reminder_deliveries')->insertOrIgnore([
                        'task_id' => $task->id,
                        'remind_at' => $task->remind_at,
                        'sent_at' => $now->format('Y-m-d H:i:sP'),
                    ]);

                    if ($inserted === 1) {
                        $claimed[] = $task;
                    }
                }

                return $claimed;
            });

            if (empty($batch)) {
                break;
            }

            $totalClaimed += count($batch);

            $userIds = collect($batch)->pluck('user_id')->unique()->all();
            $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');
            $subscriptions = PushSubscription::withoutGlobalScope('owner')
                ->whereIn('user_id', $userIds)
                ->get()
                ->groupBy('user_id');

            $projectIds = collect($batch)->pluck('project_id')->filter()->unique()->all();
            $projects = empty($projectIds)
                ? collect()
                : Project::withoutGlobalScope('owner')->whereIn('id', $projectIds)->get()->keyBy('id');

            $messages = [];

            foreach ($batch as $task) {
                $user = $users->get($task->user_id);
                $subs = $subscriptions->get($task->user_id, collect());
                if ($subs->isEmpty()) {
                    continue;
                }

                $title = (string) $task->title;

                $dateStr = ! empty($task->start_date) ? (string) $task->start_date : (string) $task->due_date;
                $weekday = ! empty($dateStr)
                    ? (new DateTimeImmutable($dateStr))->format('D')
                    : $now->format('D');

                $timeStr = ! empty($task->start_date)
                    ? ($task->start_time ?: '09:00')
                    : ($task->due_time ?: '09:00');

                $timeFormatted = (new DateTimeImmutable("2000-01-01 {$timeStr}"))->format(
                    ($user?->time_format === '12h') ? 'g:i A' : 'H:i'
                );

                $body = "{$weekday} {$timeFormatted}";

                $project = $task->project_id ? $projects->get($task->project_id) : null;
                if ($project !== null && $project->name !== '') {
                    $body .= ' · '.$project->name;
                }

                $payload = [
                    'title' => $title,
                    'body' => $body,
                    'url' => "/tasks/{$task->id}",
                    'tag' => (string) $task->id,
                ];

                foreach ($subs as $sub) {
                    $messages[] = [
                        'subscription' => $sub,
                        'payload' => $payload,
                    ];
                }
            }

            if (! empty($messages)) {
                try {
                    $gone = $this->push->send($messages);
                    if (! empty($gone)) {
                        PushSubscription::withoutGlobalScope('owner')
                            ->whereIn('endpoint', $gone)
                            ->delete();
                    }
                } catch (Throwable $e) {
                    $this->logger->error('Failed to send push notifications: {count} messages attempted', [
                        'count' => count($messages),
                        'exception' => $e::class,
                    ]);
                }
            }
        }

        return $totalClaimed;
    }
}
