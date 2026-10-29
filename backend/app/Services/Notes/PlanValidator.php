<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Opis\JsonSchema\Validator;

final class PlanValidator
{
    private Validator $schema;

    public function __construct()
    {
        $this->schema = new Validator;
        $this->schema->resolver()?->registerPrefix('https://agendal.app/schemas/', base_path('../docs/07-architecture/contracts/schemas/'));
    }

    /**
     * @param  array<string, mixed>  $plan
     * @param  array<string, string>  $projects
     * @param  array<string, array<string, mixed>>  $tasks
     * @return array<string, mixed>
     */
    public function validate(array $plan, array $projects, array $tasks): array
    {
        $valid = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => $plan['skipped'] ?? [], 'ambiguous' => []];
        $dropped = 0;
        foreach (['create', 'update', 'delete'] as $kind) {
            foreach ($plan[$kind] ?? [] as $entry) {
                if (! is_array($entry) || ! $this->entry($kind, $entry, $projects, $tasks)) {
                    $dropped++;

                    continue;
                }
                $valid[$kind][] = $entry;
            }
        }
        $refs = array_column([...$valid['update'], ...$valid['delete']], 'ref');
        foreach ($plan['ambiguous'] ?? [] as $tie) {
            if (in_array($tie['ref'] ?? null, $refs, true) && count($tie['candidates'] ?? []) >= 2
                && count($tie['candidates']) <= 5 && array_diff($tie['candidates'], array_keys($tasks)) === []
                && in_array($tie['preselected'] ?? null, $tie['candidates'], true)) {
                $valid['ambiguous'][] = $tie;
            }
        }
        $valid['dropped'] = $dropped;

        return $valid;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, string>  $projects
     * @param  array<string, array<string, mixed>>  $tasks
     */
    private function entry(string $kind, array $entry, array $projects, array $tasks): bool
    {
        $object = json_decode(json_encode($entry, JSON_THROW_ON_ERROR));
        if (! $this->schema->validate($object, 'https://agendal.app/schemas/note-result.schema.json#/$defs/'.$kind)->isValid()) {
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
        $merged = $kind === 'create' ? $entry : array_replace($tasks[$entry['task_id']], $entry);
        if ($kind === 'create' && $merged['due_date'] === null
            && ($merged['start_time'] !== null || $merged['repeat'] !== 'never' || $merged['reminder'] !== 'none')) {
            return false;
        }
        $start = $merged['start_time'] ?? null;
        $end = $merged['end_time'] ?? null;

        return $end === null || ($start !== null && $end > $start);
    }

    /** @param array<string, mixed> $plan */
    public function status(array $plan): string
    {
        $changes = count($plan['create']) + count($plan['update']) + count($plan['delete']);
        if ($plan['delete'] !== [] || $plan['ambiguous'] !== [] || $changes > 5) {
            return 'confirm';
        }
        if ($changes > 0) {
            return 'done';
        }
        foreach ($plan['skipped'] as $skip) {
            if ($skip['reason'] === 'skip') {
                return 'followup';
            }
        }

        return $plan['skipped'] === [] ? 'followup' : 'done';
    }
}
