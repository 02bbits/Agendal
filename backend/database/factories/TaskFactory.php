<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\DueDateFallback;
use App\Support\Stamp;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * A task as POST /tasks makes it: the server-set fields (stamps, remind_at, repeat_anchor, the
 * start date of a repeat with no date) are worked out the same way, in the owner's timezone.
 *
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Set here: a seeder runs without model events, so HasUuids would not fill it
            'id' => (string) Str::uuid7(),
            'user_id' => User::factory(),
            'title' => rtrim(fake()->sentence(3), '.'),
            'reminder' => 'none',
            'repeat' => 'never',
            'done' => false,
            'created_by' => 'user',
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (Task $task): void {
            $clock = app(ClockInterface::class);
            $timezone = self::timezoneOf($task->user_id);

            if (DueDateFallback::needed($task->due_date, $task->start_date, $task->repeat)) {
                $task->start_date = $clock->today($timezone);
            }
            $task->field_updated_at = array_fill_keys([...Task::PATCHABLE, 'done', 'deleted'], Stamp::of($clock->now()));
            $task->remind_at = $task->reminder === 'none' ? null : app(ReminderCalculator::class)
                ->forDates($task->start_date, $task->start_time, $task->due_date, $task->due_time, $task->reminder, $timezone);
            $task->repeat_anchor = $task->repeat === 'never' ? null : ($task->start_date ?: $task->due_date);
        });
    }

    public function done(): static
    {
        return $this->state(fn (): array => ['done' => true, 'done_at' => app(ClockInterface::class)->now()]);
    }

    /** Due `days` from today in the owner's timezone; negative is in the past. */
    public function dueIn(int $days): static
    {
        return $this->state(['due_date' => fn (array $attributes): string => self::day($attributes['user_id'], $days)]);
    }

    public function dueToday(): static
    {
        return $this->dueIn(0);
    }

    public function overdue(int $days = 1): static
    {
        return $this->dueIn(-$days);
    }

    public function repeating(string $repeat = 'daily'): static
    {
        return $this->state(['repeat' => $repeat]);
    }

    /** In `project`, or a new project of the same owner. */
    public function inProject(?Project $project = null): static
    {
        return $this->state(['project_id' => $project !== null ? $project->id
            : fn (array $attributes): string => Project::factory()->create(['user_id' => $attributes['user_id']])->id]);
    }

    private static function day(int $userId, int $days): string
    {
        $today = app(ClockInterface::class)->today(self::timezoneOf($userId));

        return (new DateTimeImmutable($today))->modify("{$days} days")->format('Y-m-d');
    }

    private static function timezoneOf(int $userId): string
    {
        return (string) User::query()->whereKey($userId)->value('timezone');
    }
}
