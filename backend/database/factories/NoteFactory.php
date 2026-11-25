<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\PlanStatus;
use App\Enums\SkipReason;
use App\Models\Note;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Notes\NoteApplier;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteNamer;
use App\Services\Notes\PlanValidator;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * A processed note. Plans come from the note engine and validator, and Apply from the applier, so
 * a confirm or done note holds what POST /notes would store.
 *
 * @extends Factory<Note>
 *
 * @phpstan-import-type ValidatedPlan from PlanValidator
 */
class NoteFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $now = app(ClockInterface::class)->now();

        return [
            // Set here: a seeder runs without model events, so HasUuids would not fill it
            'id' => (string) Str::uuid7(),
            'user_id' => User::factory(),
            'client_id' => (string) Str::uuid(),
            // Nothing actionable, so POST /notes gives it a follow-up too
            'text' => 'idea: '.rtrim(fake()->sentence(3), '.'),
            'status' => PlanStatus::Followup->value,
            'plan' => fn (array $attributes): array => app(PlanValidator::class)->validate([
                'create' => [], 'update' => [], 'delete' => [], 'ambiguous' => [],
                'skipped' => [['ref' => 'i1', 'text' => $attributes['text'], 'reason' => SkipReason::Skip->value]],
            ], [], []),
            'applied' => [],
            'engine' => 'rules',
            'written_at' => $now,
            'written_tz' => fn (array $attributes): string => (string) User::query()->whereKey($attributes['user_id'])->value('timezone'),
            'processed_at' => $now,
            'plan_version' => 1,
            'name' => fn (array $attributes): string => app(NoteNamer::class)
                ->name($attributes['plan'], $attributes['text'], new NoteContext($now, $attributes['written_tz']), []),
        ];
    }

    /** Nothing actionable: the note asks whether to keep it as a task (BR-02). */
    public function followup(): static
    {
        return $this->state(['status' => PlanStatus::Followup->value]);
    }

    /** Kept as a task from the follow-up (RV-3), waiting for Apply changes. */
    public function confirm(): static
    {
        return $this->state(['status' => PlanStatus::Confirm->value])->afterCreating(function (Note $note): void {
            $plan = $this->taskPlan($note);
            $note->plan = [...$plan, 'followup_task' => true, 'changes' => app(NoteApplier::class)->preview($note, $plan)];
            $note->save();
        });
    }

    /** Kept as a task and applied: the task exists. */
    public function done(): static
    {
        return $this->state(['status' => PlanStatus::Done->value])->afterCreating(function (Note $note): void {
            $plan = $this->taskPlan($note);
            $result = app(NoteApplier::class)->apply($note, $plan);
            $note->applied = $result['applied'];
            $note->plan = [...$plan, 'followup_task' => true, 'excluded' => [], 'changes' => $result['changes'], 'skipped' => $result['skipped']];
            $note->save();
        });
    }

    /** @return ValidatedPlan */
    private function taskPlan(Note $note): array
    {
        $build = app(NoteEngine::class)->plainTask($note->text, new NoteContext($note->written_at->toDateTimeImmutable(), $note->written_tz));
        $note->name = $build->name;

        return $build->plan;
    }
}
