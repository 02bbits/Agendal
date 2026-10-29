<?php

declare(strict_types=1);

namespace App\Services\Notes;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Validation\ValidationException;
use Ramsey\Uuid\Uuid;
use Symfony\Component\Yaml\Yaml;

final class CorpusRunner
{
    private const GATES = ['count' => 0.95, 'title' => 0.95, 'due_date' => 0.95, 'start_time' => 0.95, 'priority' => 0.9, 'project_id' => 0.9, 'repeat' => 0.9, 'reminder' => 0.9, 'commands' => 1.0, 'safety' => 1.0, 'name' => 1.0];

    public function __construct(private NoteEngine $engine, private OpenRouterFallback $fallback) {}

    /**
     * @param  list<string>  $files
     * @return list<array<string, mixed>>
     */
    public function load(array $files): array
    {
        $cases = [];
        $ids = [];
        foreach ($files as $file) {
            $data = Yaml::parseFile($file);
            if (! is_array($data) || ! array_is_list($data)) {
                throw new \RuntimeException('Corpus files must contain a case list');
            }
            foreach ($data as $case) {
                if (! is_array($case) || ! isset($case['id'], $case['note'], $case['expect'], $case['categories']) || isset($ids[$case['id']])) {
                    throw new \RuntimeException('Invalid or duplicate corpus case');
                }
                $ids[$case['id']] = true;
                foreach ($case['expect']['create'] ?? [] as $task) {
                    if (! is_array($task) || ! isset($task['title']) || array_diff(array_keys($task), ['title', 'due', 'start', 'end', 'priority', 'project', 'repeat', 'reminder', 'notes', 'duplicate_of']) !== []) {
                        throw new \RuntimeException('Malformed create expectation in '.$case['id']);
                    }
                }
                $cases[] = $case;
            }
        }

        return $cases;
    }

    /**
     * @param  list<array<string, mixed>>  $cases
     * @return list<string>
     */
    public function quotas(array $cases): array
    {
        $issues = count($cases) < 200 ? ['At least 200 cases required'] : [];
        $counts = [];
        foreach ($cases as $case) {
            foreach (array_unique($case['categories']) as $category) {
                $counts[$category] = ($counts[$category] ?? 0) + 1;
            }
        }
        foreach ($counts as $category => $count) {
            if (! str_starts_with($category, 'edge.') && $count < 8) {
                $issues[] = $category.' needs '.(8 - $count).' more cases';
            }
        }
        foreach (range(1, 41) as $edge) {
            if (! isset($counts['edge.NU-E'.$edge])) {
                $issues[] = 'Missing NU-E'.$edge;
            }
        }

        return $issues;
    }

    /**
     * @param  list<array<string, mixed>>  $cases
     * @return array<string, mixed>
     */
    public function run(array $cases, string $mode = 'rules'): array
    {
        $totals = array_fill_keys(array_keys(self::GATES), 0);
        $correct = $totals;
        $failures = [];
        $llm = 0;
        foreach ($cases as $case) {
            $context = $this->context($case);
            $open = $this->tasks($case['open_tasks'] ?? [], false);
            $done = $this->tasks($case['done_tasks'] ?? [], true);
            try {
                $actual = $this->engine->build($case['note'], $context, $open, $done);
                if ($mode === 'llm') {
                    $actual = $this->fallback->resolve($actual, $case['note'], $context, $open, 0);
                    $llm += $actual['engine'] === 'rules_llm' ? 1 : 0;
                }
            } catch (ValidationException $error) {
                $actual = ['status' => 'error', 'error' => $error->errors()['text'][0] ?? 'error.invalid', 'plan' => ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []]];
            }
            $scores = $this->score($actual, $case['expect'], $context, $open);
            foreach ($scores as $metric => $values) {
                foreach ($values as $right) {
                    $totals[$metric]++;
                    $correct[$metric] += $right ? 1 : 0;
                    if (! $right) {
                        $failures[$case['id']][$metric] = true;
                    }
                }
            }
        }
        $gates = [];
        foreach (self::GATES as $metric => $threshold) {
            $accuracy = $totals[$metric] === 0 ? 1.0 : $correct[$metric] / $totals[$metric];
            $required = $mode === 'llm' && $metric === 'name' ? 0.95 : $threshold;
            $gates[$metric] = ['correct' => $correct[$metric], 'total' => $totals[$metric], 'accuracy' => $accuracy, 'required' => $required, 'passed' => $accuracy >= $required];
        }

        return ['passed' => ! in_array(false, array_column($gates, 'passed'), true) && ($mode !== 'llm' || $llm > 0), 'gates' => $gates, 'failures' => $failures, 'llm_notes' => $llm, 'cases' => count($cases)];
    }

    /** @param array<string, mixed> $case */
    private function context(array $case): NoteContext
    {
        $projects = [];
        foreach ($case['projects'] ?? ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'] as $name) {
            $projects[$this->id('project:'.$name)] = $name;
        }
        $zone = $case['timezone'] ?? 'Asia/Ho_Chi_Minh';

        return new NoteContext(new DateTimeImmutable($case['now'] ?? '2026-10-23T08:12', new DateTimeZone($zone)), $zone, $projects, $case['week_start'] ?? 'monday');
    }

    /**
     * @param  list<array<string, mixed>>  $tasks
     * @return list<array<string, mixed>>
     */
    private function tasks(array $tasks, bool $done): array
    {
        return array_map(fn (array $task): array => ['id' => $this->id($task['id']), 'title' => $task['title'], 'done' => $done, 'due_date' => $task['due'] ?? null, 'start_time' => $task['start'] ?? null, 'end_time' => $task['end'] ?? null, 'repeat' => $task['repeat'] ?? 'never'], $tasks);
    }

    /**
     * @param  array<string, mixed>  $actual
     * @param  array<string, mixed>  $expected
     * @param  list<array<string, mixed>>  $tasks
     * @return array<string, list<bool>>
     */
    private function score(array $actual, array $expected, NoteContext $context, array $tasks): array
    {
        $plan = $actual['plan'];
        $scores = ['safety' => [$actual['status'] === $expected['status']], 'count' => []];
        if ($expected['status'] === 'error') {
            $scores['safety'][] = ($actual['error'] ?? null) === ($expected['error'] ?? null);

            return $scores;
        }
        foreach (['create', 'update', 'delete'] as $kind) {
            $scores['count'][] = count($plan[$kind]) === count($expected[$kind] ?? []);
        }
        foreach ($expected['create'] ?? [] as $index => $task) {
            $scores['title'][] = ($plan['create'][$index]['title'] ?? null) === $task['title'];
            $defaults = ['due' => null, 'start' => null, 'priority' => ($task['due'] ?? null) === $context->local()->format('Y-m-d') ? 'medium' : 'low', 'project' => null, 'repeat' => 'never', 'reminder' => 'none'];
            foreach (['due' => 'due_date', 'start' => 'start_time', 'priority' => 'priority', 'project' => 'project_id', 'repeat' => 'repeat', 'reminder' => 'reminder'] as $field => $metric) {
                $value = $task[$field] ?? $defaults[$field];
                if ($field === 'project' && $value !== null) {
                    $value = $this->id('project:'.$value);
                }
                $scores[$metric][] = isset($plan['create'][$index]) && ($plan['create'][$index][$metric] ?? null) === $value;
            }
        }
        $byId = array_column($tasks, null, 'id');
        $expectedTargets = [];
        foreach ($expected['update'] ?? [] as $index => $change) {
            $id = $this->id($change['task']);
            $expectedTargets[] = $id;
            $entry = $plan['update'][$index] ?? [];
            $merged = array_replace($byId[$id] ?? [], $entry);
            foreach ($change as $field => $value) {
                if ($field === 'task') {
                    continue;
                }
                $key = ['due' => 'due_date', 'start' => 'start_time', 'end' => 'end_time'][$field] ?? $field;
                $scores['commands'][] = ($merged[$key] ?? null) === $value;
            }
        }
        $scores['commands'][] = array_column($plan['update'], 'task_id') === $expectedTargets;
        $scores['commands'][] = array_column($plan['delete'], 'task_id') === array_map(fn (string $id): string => $this->id($id), $expected['delete'] ?? []);
        foreach ($expected['ambiguous'] ?? [] as $index => $tie) {
            $scores['commands'][] = ($plan['ambiguous'][$index]['candidates'] ?? []) === array_map(fn (string $id): string => $this->id($id), $tie['candidates']);
            $scores['commands'][] = ($plan['ambiguous'][$index]['preselected'] ?? null) === $this->id($tie['preselected']);
        }
        foreach ($expected['skipped'] ?? [] as $index => $skip) {
            $scores['safety'][] = ($plan['skipped'][$index]['reason'] ?? null) === $skip['reason'] && ($plan['skipped'][$index]['text'] ?? null) === $skip['text'];
        }
        if (isset($expected['name'])) {
            $scores['name'][] = ($actual['name'] ?? null) === $expected['name'];
        }

        return $scores;
    }

    private function id(string $value): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, 'agendal-corpus:'.$value)->toString();
    }
}
