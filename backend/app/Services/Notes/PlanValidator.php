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

    /** Keys that name an update and describe it; the rest are the fields it changes. */
    private const ENTRY_KEYS = ['ref', 'task_id', 'label'];

    /** Fields that schedule a task: an entry setting one has to leave a date when the task has a time, repeat or reminder. */
    private const SCHEDULE_FIELDS = ['due_date', 'start_time', 'repeat', 'reminder'];

    private Validator $schema;

    public function __construct(private PlanStatusResolver $statuses)
    {
        $this->schema = new Validator;
        $this->schema->resolver()?->registerPrefix(self::SCHEMA_ID, (string) config('notes.schema_path'));
    }

    /**
     * Entries for the same task are checked one after another on the task as the earlier ones leave it. A ref names
     * one entry; a later one with the same ref drops.
     *
     * `needs_confirm` keeps a plan waiting for Apply changes, also when it is validated again (NU-E38), when:
     * - a tie is broken: it drops, and its change, the best match, waits (NU-E11)
     * - two entries set a field of the same task to different values
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
        $needsConfirm = ($plan['needs_confirm'] ?? false) === true;
        $refs = [];
        $after = $tasks;
        $setFields = [];
        $created = [];
        foreach (self::ENTRY_KINDS as $kind) {
            foreach ($this->items($plan[$kind] ?? [], $dropped) as $entry) {
                // Two items of one note that make the very same task make it once.
                $newTask = $kind === 'create' ? json_encode(array_diff_key($entry, ['ref' => true]), JSON_THROW_ON_ERROR) : '';
                if (! $this->entryIsValid($kind, $entry, $projects, $after) || isset($refs[$entry['ref']]) || isset($created[$newTask])) {
                    $dropped++;

                    continue;
                }
                $refs[$entry['ref']] = true;
                $valid[$kind][] = $entry;
                if ($kind === 'create') {
                    $created[$newTask] = true;

                    continue;
                }
                $id = $entry['task_id'];
                $fields = array_diff_key($entry, array_flip(self::ENTRY_KEYS));
                foreach ($fields as $field => $value) {
                    $needsConfirm = $needsConfirm || (array_key_exists($field, $setFields[$id] ?? []) && $setFields[$id][$field] !== $value);
                }
                $setFields[$id] = [...$setFields[$id] ?? [], ...$fields];
                $after[$id] = array_replace($after[$id], $fields);
            }
        }
        foreach ($this->items($plan['skipped'] ?? [], $dropped) as $item) {
            $skip = $this->readableSkip($item);
            if ($skip === null || isset($refs[$skip['ref']])) {
                $dropped++;

                continue;
            }
            $refs[$skip['ref']] = true;
            $valid['skipped'][] = $skip;
        }
        $changedTasks = array_column([...$valid['update'], ...$valid['delete']], 'task_id', 'ref');
        $asked = [];
        foreach ($this->items($plan['ambiguous'] ?? [], $dropped) as $tie) {
            $tie = $this->withUniqueCandidates($tie);
            $ref = $tie['ref'] ?? null;
            $ofKeptChange = is_string($ref) && array_key_exists($ref, $changedTasks) && ! isset($asked[$ref]);
            if ($ofKeptChange && $this->tieIsValid($tie, $changedTasks[$ref], $tasks)) {
                $asked[$ref] = true;
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
     * A plan part that isn't a list drops whole, and so does any of its items that isn't an object.
     *
     * @return list<array<string, mixed>>
     */
    private function items(mixed $part, int &$dropped): array
    {
        if (! is_array($part)) {
            $dropped++;

            return [];
        }
        /** @var list<array<string, mixed>> $items */
        $items = array_values(array_filter($part, is_array(...)));
        $dropped += count($part) - count($items);

        return $items;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, string>  $projects
     * @param  array<string, array<string, mixed>>  $tasks  each task as the entries kept so far leave it
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
     * A skip keeps its ref, text and reason; a reason the server doesn't know becomes a plain skip, so the follow-up
     * offers the text (BR-02).
     *
     * @param  array<string, mixed>  $skip
     * @return array{ref: string, text: string, reason: string}|null
     */
    private function readableSkip(array $skip): ?array
    {
        if (! is_string($skip['ref'] ?? null) || ! is_string($skip['text'] ?? null)) {
            return null;
        }
        $reason = is_string($skip['reason'] ?? null) ? SkipReason::tryFrom($skip['reason']) : null;

        return ['ref' => $skip['ref'], 'text' => $skip['text'], 'reason' => ($reason ?? SkipReason::Skip)->value];
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
     * A task the entry schedules keeps a due date while it has a time, repeat or reminder; the engine always gives
     * one (NU-E5).
     *
     * @param  array<string, mixed>  $entry
     * @param  array<string, mixed>  $task  the task after the entry
     */
    private function hasDateWhenNeeded(array $entry, array $task): bool
    {
        $schedules = array_intersect_key($entry, array_flip(self::SCHEDULE_FIELDS)) !== [];
        $needsDate = ($task['start_time'] ?? null) !== null
            || ($task['repeat'] ?? Repeat::Never->value) !== Repeat::Never->value
            || ($task['reminder'] ?? Reminder::None->value) !== Reminder::None->value;

        return ! $schedules || ! $needsDate || ($task['due_date'] ?? null) !== null;
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
     * "Which task did you mean?" lists a task once: a repeated candidate drops (NU-E11).
     *
     * @param  array<string, mixed>  $tie
     * @return array<string, mixed>
     */
    private function withUniqueCandidates(array $tie): array
    {
        if (is_array($tie['candidates'] ?? null)) {
            $tie['candidates'] = array_values(array_unique($tie['candidates'], SORT_REGULAR));
        }

        return $tie;
    }

    /**
     * NU-E11: a tie offers 2 (the schema) to the configured number of the user's tasks and preselects the one its
     * change names, so Apply changes without a choice changes a task the screen showed.
     *
     * @param  array<string, mixed>  $tie
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
