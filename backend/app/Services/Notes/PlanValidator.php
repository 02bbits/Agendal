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
 * @phpstan-type Plan array{create: list<array<string, mixed>>, update: list<array<string, mixed>>, delete: list<array<string, mixed>>, skipped: list<array{ref: string, text: string, reason: string}>, ambiguous: list<array<string, mixed>>, needs_confirm?: bool}
 * @phpstan-type ValidatedPlan array{create: list<array<string, mixed>>, update: list<array<string, mixed>>, delete: list<array<string, mixed>>, skipped: list<array{ref: string, text: string, reason: string}>, ambiguous: list<array<string, mixed>>, dropped: int, needs_confirm: bool}
 */
final class PlanValidator
{
    private const SCHEMA_ID = 'https://agendal.app/schemas/';

    private const ENTRY_KINDS = ['create', 'update', 'delete'];

    private Validator $schema;

    public function __construct(private PlanStatusResolver $statuses)
    {
        $this->schema = new Validator;
        $this->schema->resolver()?->registerPrefix(self::SCHEMA_ID, (string) config('notes.schema_path'));
    }

    /**
     * A broken tie still asks: its change, the best match, waits for Apply changes (`needs_confirm`, NU-E11).
     *
     * @param  array<string, mixed>  $plan
     * @param  array<string, string>  $projects  the user's project ids => names
     * @param  array<string, array<string, mixed>>  $tasks  the tasks entries may name: the user's own, and for the LLM only its candidates
     * @return ValidatedPlan
     */
    public function validate(array $plan, array $projects, array $tasks): array
    {
        $valid = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
        $dropped = 0;
        $needsConfirm = false;
        foreach (self::ENTRY_KINDS as $kind) {
            foreach ($plan[$kind] ?? [] as $entry) {
                if (is_array($entry) && $this->entryIsValid($kind, $entry, $projects, $tasks)) {
                    $valid[$kind][] = $entry;
                } else {
                    $dropped++;
                }
            }
        }
        foreach ($plan['skipped'] ?? [] as $skip) {
            $kept = is_array($skip) ? $this->readableSkip($skip) : null;
            if ($kept === null) {
                $dropped++;
            } else {
                $valid['skipped'][] = $kept;
            }
        }
        $changedTasks = array_column([...$valid['update'], ...$valid['delete']], 'task_id', 'ref');
        foreach ($plan['ambiguous'] ?? [] as $tie) {
            $ref = is_array($tie) ? ($tie['ref'] ?? null) : null;
            $ofKeptChange = is_string($ref) && array_key_exists($ref, $changedTasks);
            if ($ofKeptChange && $this->tieIsValid($tie, $changedTasks[$ref], $tasks)) {
                $valid['ambiguous'][] = $tie;

                continue;
            }
            $dropped++;
            $needsConfirm = $needsConfirm || $ofKeptChange;
        }

        return [...$valid, 'dropped' => $dropped, 'needs_confirm' => $needsConfirm];
    }

    /**
     * A change is one task: two entries for the same task count once (BR-01).
     *
     * @param  Plan  $plan
     */
    public function status(array $plan): PlanStatus
    {
        $changes = count($plan['create']) + count(array_unique(array_column([...$plan['update'], ...$plan['delete']], 'task_id')));
        $skipReasons = array_map(fn (array $skip): SkipReason => SkipReason::from($skip['reason']), $plan['skipped']);

        $hasTie = $plan['ambiguous'] !== [] || ($plan['needs_confirm'] ?? false);

        return $this->statuses->resolve($changes, $plan['delete'] !== [], $hasTie, $skipReasons);
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, string>  $projects
     * @param  array<string, array<string, mixed>>  $tasks
     */
    private function entryIsValid(string $kind, array $entry, array $projects, array $tasks): bool
    {
        if (! $this->matchesSchema('$defs/'.$kind, $entry) || ! $this->hasVisibleTitle($entry)) {
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

        return $this->hasDateWhenNeeded($entry, $result) && $this->endsAfterStart($result);
    }

    /**
     * @param  string  $pointer  where the definition sits in the note result schema
     * @param  array<mixed>  $value
     */
    private function matchesSchema(string $pointer, array $value): bool
    {
        $object = json_decode(json_encode($value, JSON_THROW_ON_ERROR));

        return $this->schema->validate($object, self::SCHEMA_ID.'note-result.schema.json#/'.$pointer)->isValid();
    }

    /**
     * A skip with a reason the server doesn't know keeps its text as a plain skip, so the follow-up offers it (BR-02).
     *
     * @param  array<mixed>  $skip
     * @return array{ref: string, text: string, reason: string}|null
     */
    private function readableSkip(array $skip): ?array
    {
        if (! is_string($skip['ref'] ?? null) || ! is_string($skip['text'] ?? null)) {
            return null;
        }
        $reason = $this->matchesSchema('properties/skipped/items', $skip) ? (string) $skip['reason'] : SkipReason::Skip->value;

        return ['ref' => $skip['ref'], 'text' => $skip['text'], 'reason' => $reason];
    }

    /**
     * The schema allows "   " or only invisible characters; a title must have something to read (NU §8, NU-E15).
     *
     * @param  array<string, mixed>  $entry
     */
    private function hasVisibleTitle(array $entry): bool
    {
        return ! array_key_exists('title', $entry) || preg_match('~[^\p{Z}\p{C}\s]~u', (string) $entry['title']) === 1;
    }

    /**
     * A time, repeat or reminder the entry sets needs a due date; the engine always gives one (NU-E5).
     *
     * @param  array<string, mixed>  $entry
     * @param  array<string, mixed>  $task  the task after the entry
     */
    private function hasDateWhenNeeded(array $entry, array $task): bool
    {
        $setsSchedule = ($entry['start_time'] ?? null) !== null
            || ($entry['repeat'] ?? Repeat::Never->value) !== Repeat::Never->value
            || ($entry['reminder'] ?? Reminder::None->value) !== Reminder::None->value;

        return ! $setsSchedule || ($task['due_date'] ?? null) !== null;
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
     * NU-E11: a tie offers 2 (the schema) to the configured number of the user's tasks and preselects the one its
     * change names, so Apply changes without a choice changes a task the screen showed.
     *
     * @param  array<mixed>  $tie
     * @param  array<string, array<string, mixed>>  $tasks
     */
    private function tieIsValid(array $tie, mixed $changedTask, array $tasks): bool
    {
        return $this->matchesSchema('properties/ambiguous/items', $tie)
            && count($tie['candidates']) <= (int) config('notes.tie_choices')
            && array_diff($tie['candidates'], array_keys($tasks)) === []
            && $tie['preselected'] === $changedTask
            && in_array($changedTask, $tie['candidates'], true);
    }
}
