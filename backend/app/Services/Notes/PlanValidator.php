<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\PlanStatus;
use App\Enums\Reminder;
use App\Enums\Repeat;
use App\Enums\SkipReason;
use Opis\JsonSchema\Validator;

/**
 * Checks every plan entry, whoever produced it, and drops the ones that fail (NU §8, NU-5).
 * The plan keeps the note result contract's JSON shape.
 *
 * @phpstan-type Plan array{create: list<array<string, mixed>>, update: list<array<string, mixed>>, delete: list<array<string, mixed>>, skipped: list<array{ref: string, text: string, reason: string}>, ambiguous: list<array<string, mixed>>}
 * @phpstan-type ValidatedPlan array{create: list<array<string, mixed>>, update: list<array<string, mixed>>, delete: list<array<string, mixed>>, skipped: list<array{ref: string, text: string, reason: string}>, ambiguous: list<array<string, mixed>>, dropped: int}
 */
final class PlanValidator
{
    private const SCHEMA_ID = 'https://agendal.app/schemas/';

    private const ENTRY_KINDS = ['create', 'update', 'delete'];

    /** A tie offers a choice between at least two tasks (NU-E11). */
    private const MIN_TIE_CHOICES = 2;

    private Validator $schema;

    public function __construct(private PlanStatusResolver $statuses)
    {
        $this->schema = new Validator;
        $this->schema->resolver()?->registerPrefix(self::SCHEMA_ID, (string) config('notes.schema_path'));
    }

    /**
     * @param  array<string, mixed>  $plan
     * @param  array<string, string>  $projects  the user's project ids => names
     * @param  array<string, array<string, mixed>>  $tasks  the tasks entries may name: the user's own, and for the LLM only its candidates
     * @return ValidatedPlan
     */
    public function validate(array $plan, array $projects, array $tasks): array
    {
        $valid = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => $plan['skipped'] ?? [], 'ambiguous' => []];
        $dropped = 0;
        foreach (self::ENTRY_KINDS as $kind) {
            foreach ($plan[$kind] ?? [] as $entry) {
                if (is_array($entry) && $this->entryIsValid($kind, $entry, $projects, $tasks)) {
                    $valid[$kind][] = $entry;
                } else {
                    $dropped++;
                }
            }
        }
        $changedRefs = array_column([...$valid['update'], ...$valid['delete']], 'ref');
        foreach ($plan['ambiguous'] ?? [] as $tie) {
            if (is_array($tie) && $this->tieIsValid($tie, $changedRefs, $tasks)) {
                $valid['ambiguous'][] = $tie;
            }
        }

        return [...$valid, 'dropped' => $dropped];
    }

    /** @param Plan $plan */
    public function status(array $plan): PlanStatus
    {
        $changes = count($plan['create']) + count($plan['update']) + count($plan['delete']);
        $skipReasons = array_map(fn (array $skip): SkipReason => SkipReason::from($skip['reason']), $plan['skipped']);

        return $this->statuses->resolve($changes, $plan['delete'] !== [], $plan['ambiguous'] !== [], $skipReasons);
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, string>  $projects
     * @param  array<string, array<string, mixed>>  $tasks
     */
    private function entryIsValid(string $kind, array $entry, array $projects, array $tasks): bool
    {
        if (! $this->matchesSchema($kind, $entry) || ! $this->hasVisibleTitle($entry)) {
            return false;
        }
        if (isset($entry['project_id']) && ! array_key_exists($entry['project_id'], $projects)) {
            return false;
        }
        if (isset($entry['duplicate_of']) && ! array_key_exists($entry['duplicate_of'], $tasks)) {
            return false;
        }
        if ($kind !== 'create' && ! array_key_exists($entry['task_id'], $tasks)) {
            return false;
        }
        $result = $kind === 'create' ? $entry : array_replace($tasks[$entry['task_id']], $entry);

        return $this->hasDateWhenNeeded($kind, $result) && $this->endsAfterStart($result);
    }

    /** @param array<string, mixed> $entry */
    private function matchesSchema(string $kind, array $entry): bool
    {
        $object = json_decode(json_encode($entry, JSON_THROW_ON_ERROR));

        return $this->schema->validate($object, self::SCHEMA_ID.'note-result.schema.json#/$defs/'.$kind)->isValid();
    }

    /**
     * The schema allows "   "; a title must have something to read (NU §8: 1–200 characters).
     *
     * @param  array<string, mixed>  $entry
     */
    private function hasVisibleTitle(array $entry): bool
    {
        return ! array_key_exists('title', $entry) || trim((string) $entry['title']) !== '';
    }

    /**
     * A new task with a time, repeat or reminder needs a due date (NU-E5).
     *
     * @param  array<string, mixed>  $task
     */
    private function hasDateWhenNeeded(string $kind, array $task): bool
    {
        $needsDate = ($task['start_time'] ?? null) !== null
            || ($task['repeat'] ?? Repeat::Never->value) !== Repeat::Never->value
            || ($task['reminder'] ?? Reminder::None->value) !== Reminder::None->value;

        return $kind !== 'create' || ! $needsDate || $task['due_date'] !== null;
    }

    /**
     * The end is after the start; an end alone has nothing to follow (TK-3).
     *
     * @param  array<string, mixed>  $task
     */
    private function endsAfterStart(array $task): bool
    {
        $start = $task['start_time'] ?? null;
        $end = $task['end_time'] ?? null;

        return $end === null || ($start !== null && $end > $start);
    }

    /**
     * NU-E11: a tie belongs to a kept change and offers 2 to the configured number of the user's tasks,
     * one of them preselected.
     *
     * @param  array<string, mixed>  $tie
     * @param  list<mixed>  $changedRefs
     * @param  array<string, array<string, mixed>>  $tasks
     */
    private function tieIsValid(array $tie, array $changedRefs, array $tasks): bool
    {
        $candidates = $tie['candidates'] ?? null;
        if (! is_array($candidates) || ! in_array($tie['ref'] ?? null, $changedRefs, true)) {
            return false;
        }

        return count($candidates) >= self::MIN_TIE_CHOICES
            && count($candidates) <= (int) config('notes.tie_choices')
            && array_diff($candidates, array_keys($tasks)) === []
            && in_array($tie['preselected'] ?? null, $candidates, true);
    }
}
