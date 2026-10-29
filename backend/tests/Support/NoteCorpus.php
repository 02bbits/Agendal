<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Enums\NoteEngineKind;
use App\Enums\WeekStart;
use App\Services\Notes\NoteBuild;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\OpenRouterFallback;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Validation\ValidationException;
use Ramsey\Uuid\Uuid;
use RuntimeException;
use Symfony\Component\Yaml\Yaml;

/**
 * Runs the golden note corpus (docs/06-testing/note-corpus) through the engine and scores it against the
 * accuracy gates and coverage quota of its README.
 */
final class NoteCorpus
{
    /** README "Accuracy gates": share of checks that must be right, per measure. */
    private const GATES = [
        'count' => 0.95, 'title' => 0.95, 'due_date' => 0.95, 'start_time' => 0.95,
        'priority' => 0.9, 'project_id' => 0.9, 'repeat' => 0.9, 'reminder' => 0.9,
        'commands' => 1.0, 'safety' => 1.0, 'name' => 1.0,
    ];

    /** Note names may differ a little more when the model rewrites a title. */
    private const LLM_NAME_GATE = 0.95;

    /** README "Coverage quota". */
    private const MIN_CASES = 200;

    private const MIN_PER_CATEGORY = 8;

    /** NU-E1 … NU-E41 in the NU module. */
    private const NU_EDGE_CASES = 41;

    private const DEFAULT_PROJECTS = ['SQL Course', 'Adv Web', 'HCI', 'Portfolio', 'Personal'];

    private const DEFAULT_NOW = '2026-10-23T08:12';

    private const DEFAULT_ZONE = 'Asia/Ho_Chi_Minh';

    private const CREATE_FIELDS = ['title', 'due', 'start', 'end', 'priority', 'project', 'repeat', 'reminder', 'notes', 'duplicate_of'];

    public function __construct(private NoteEngine $engine, private OpenRouterFallback $fallback) {}

    /** @return list<string> */
    public static function files(): array
    {
        return glob(dirname(__DIR__, 3).'/docs/06-testing/note-corpus/*.yaml') ?: [];
    }

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
                throw new RuntimeException('Corpus files must contain a case list: '.$file);
            }
            foreach ($data as $case) {
                if (! is_array($case) || ! isset($case['id'], $case['note'], $case['expect'], $case['categories']) || isset($ids[$case['id']])) {
                    throw new RuntimeException('Invalid or duplicate corpus case in '.$file);
                }
                $ids[$case['id']] = true;
                foreach ($case['expect']['create'] ?? [] as $task) {
                    if (! is_array($task) || ! isset($task['title']) || array_diff(array_keys($task), self::CREATE_FIELDS) !== []) {
                        throw new RuntimeException('Malformed create expectation in '.$case['id']);
                    }
                }
                $cases[] = $case;
            }
        }

        return $cases;
    }

    /**
     * @param  list<array<string, mixed>>  $cases
     * @return list<string> what the corpus still lacks
     */
    public function quotas(array $cases): array
    {
        $issues = count($cases) < self::MIN_CASES ? ['At least '.self::MIN_CASES.' cases required'] : [];
        $counts = [];
        foreach ($cases as $case) {
            foreach (array_unique($case['categories']) as $category) {
                $counts[$category] = ($counts[$category] ?? 0) + 1;
            }
        }
        foreach ($counts as $category => $count) {
            if (! str_starts_with($category, 'edge.') && $count < self::MIN_PER_CATEGORY) {
                $issues[] = $category.' needs '.(self::MIN_PER_CATEGORY - $count).' more cases';
            }
        }
        foreach (range(1, self::NU_EDGE_CASES) as $edge) {
            if (! isset($counts['edge.NU-E'.$edge])) {
                $issues[] = 'Missing NU-E'.$edge;
            }
        }

        return $issues;
    }

    /**
     * @param  list<array<string, mixed>>  $cases
     * @return array{passed: bool, gates: array<string, array{correct: int, total: int, accuracy: float, required: float, passed: bool}>, failures: array<string, list<string>>, llm_notes: int, cases: int}
     */
    public function run(array $cases, bool $withModel = false): array
    {
        $totals = array_fill_keys(array_keys(self::GATES), 0);
        $correct = $totals;
        $failures = [];
        $llmNotes = 0;
        foreach ($cases as $case) {
            $context = $this->context($case);
            $open = $this->tasks($case['open_tasks'] ?? [], false);
            $actual = $this->actual($case, $context, $open, $this->tasks($case['done_tasks'] ?? [], true), $withModel);
            $llmNotes += ($actual['engine'] ?? null) === NoteEngineKind::RulesWithLlm ? 1 : 0;
            foreach ($this->score($actual, $case['expect'], $context, $open) as $metric => $checks) {
                foreach ($checks as $right) {
                    $totals[$metric]++;
                    $correct[$metric] += $right ? 1 : 0;
                    if (! $right) {
                        $failures[$case['id']][] = $metric;
                    }
                }
            }
        }
        $gates = [];
        foreach (self::GATES as $metric => $threshold) {
            $accuracy = $totals[$metric] === 0 ? 1.0 : $correct[$metric] / $totals[$metric];
            $required = $withModel && $metric === 'name' ? self::LLM_NAME_GATE : $threshold;
            $gates[$metric] = ['correct' => $correct[$metric], 'total' => $totals[$metric], 'accuracy' => $accuracy, 'required' => $required, 'passed' => $accuracy >= $required];
        }
        $failures = array_map(fn (array $metrics): array => array_values(array_unique($metrics)), $failures);

        return [
            'passed' => ! in_array(false, array_column($gates, 'passed'), true) && (! $withModel || $llmNotes > 0),
            'gates' => $gates, 'failures' => $failures, 'llm_notes' => $llmNotes, 'cases' => count($cases),
        ];
    }

    /**
     * @param  array<string, mixed>  $case
     * @param  list<array<string, mixed>>  $open
     * @param  list<array<string, mixed>>  $done
     * @return array{status: string, error: ?string, plan: array<string, list<array<string, mixed>>>, name: ?string, engine: ?NoteEngineKind}
     */
    private function actual(array $case, NoteContext $context, array $open, array $done, bool $withModel): array
    {
        try {
            $build = $this->engine->build($case['note'], $context, $open, $done);
            if ($withModel) {
                $build = $this->fallback->improve($build, $case['note'], $context, $open, 0);
            }

            return $this->fromBuild($build);
        } catch (ValidationException $error) {
            $plan = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];

            return ['status' => 'error', 'error' => $error->errors()['text'][0] ?? 'error.invalid', 'plan' => $plan, 'name' => null, 'engine' => null];
        }
    }

    /** @return array{status: string, error: ?string, plan: array<string, list<array<string, mixed>>>, name: ?string, engine: ?NoteEngineKind} */
    private function fromBuild(NoteBuild $build): array
    {
        return ['status' => $build->status->value, 'error' => null, 'plan' => $build->plan, 'name' => $build->name, 'engine' => $build->engine];
    }

    /** @param array<string, mixed> $case */
    private function context(array $case): NoteContext
    {
        $projects = [];
        foreach ($case['projects'] ?? self::DEFAULT_PROJECTS as $name) {
            $projects[$this->id('project:'.$name)] = $name;
        }
        $zone = $case['timezone'] ?? self::DEFAULT_ZONE;
        $weekStart = ($case['week_start'] ?? null) === 'sunday' ? WeekStart::Sunday : WeekStart::Monday;

        return new NoteContext(new DateTimeImmutable($case['now'] ?? self::DEFAULT_NOW, new DateTimeZone($zone)), $zone, $projects, $weekStart);
    }

    /**
     * @param  list<array<string, mixed>>  $tasks
     * @return list<array{id: string, title: string, done: bool, due_date: ?string, start_time: ?string, end_time: ?string}>
     */
    private function tasks(array $tasks, bool $done): array
    {
        return array_map(fn (array $task): array => [
            'id' => $this->id($task['id']), 'title' => $task['title'], 'done' => $done,
            'due_date' => $task['due'] ?? null, 'start_time' => $task['start'] ?? null, 'end_time' => $task['end'] ?? null,
        ], $tasks);
    }

    /**
     * @param  array{status: string, error: ?string, plan: array<string, list<array<string, mixed>>>, name: ?string, engine: ?NoteEngineKind}  $actual
     * @param  array<string, mixed>  $expected
     * @param  list<array<string, mixed>>  $tasks
     * @return array<string, list<bool>>
     */
    private function score(array $actual, array $expected, NoteContext $context, array $tasks): array
    {
        $scores = ['safety' => [$actual['status'] === $expected['status']]];
        if ($expected['status'] === 'error') {
            $scores['safety'][] = $actual['error'] === ($expected['error'] ?? null);

            return $scores;
        }
        $plan = $actual['plan'];

        return array_merge_recursive(
            $scores,
            $this->scoreCreates($plan, $expected, $context),
            $this->scoreCommands($plan, $expected, $tasks),
            $this->scoreSkips($plan, $expected),
            isset($expected['name']) ? ['name' => [$actual['name'] === $expected['name']]] : [],
        );
    }

    /**
     * Omitted create fields mean the default: no date, time or project, repeat never, reminder none, and
     * priority by the default rule (medium when due today, else low).
     *
     * @param  array<string, list<array<string, mixed>>>  $plan
     * @param  array<string, mixed>  $expected
     * @return array<string, list<bool>>
     */
    private function scoreCreates(array $plan, array $expected, NoteContext $context): array
    {
        $scores = ['count' => array_map(fn (string $kind): bool => count($plan[$kind]) === count($expected[$kind] ?? []), ['create', 'update', 'delete'])];
        $today = $context->today()->format('Y-m-d');
        foreach ($expected['create'] ?? [] as $index => $task) {
            $actual = $plan['create'][$index] ?? null;
            $scores['title'][] = ($actual['title'] ?? null) === $task['title'];
            $defaults = ['due' => null, 'start' => null, 'priority' => ($task['due'] ?? null) === $today ? 'medium' : 'low', 'project' => null, 'repeat' => 'never', 'reminder' => 'none'];
            foreach (['due' => 'due_date', 'start' => 'start_time', 'priority' => 'priority', 'project' => 'project_id', 'repeat' => 'repeat', 'reminder' => 'reminder'] as $field => $metric) {
                $value = $task[$field] ?? $defaults[$field];
                if ($field === 'project' && $value !== null) {
                    $value = $this->id('project:'.$value);
                }
                $scores[$metric][] = $actual !== null && ($actual[$metric] ?? null) === $value;
            }
        }

        return $scores;
    }

    /**
     * A command must hit the right task, set the right values, and offer the right tie set.
     *
     * @param  array<string, list<array<string, mixed>>>  $plan
     * @param  array<string, mixed>  $expected
     * @param  list<array<string, mixed>>  $tasks
     * @return array<string, list<bool>>
     */
    private function scoreCommands(array $plan, array $expected, array $tasks): array
    {
        $checks = [];
        $byId = array_column($tasks, null, 'id');
        $expectedTargets = [];
        foreach ($expected['update'] ?? [] as $index => $change) {
            $id = $this->id($change['task']);
            $expectedTargets[] = $id;
            $merged = array_replace($byId[$id] ?? [], $plan['update'][$index] ?? []);
            foreach ($change as $field => $value) {
                if ($field !== 'task') {
                    $key = ['due' => 'due_date', 'start' => 'start_time', 'end' => 'end_time'][$field] ?? $field;
                    $checks[] = ($merged[$key] ?? null) === $value;
                }
            }
        }
        $checks[] = array_column($plan['update'], 'task_id') === $expectedTargets;
        $checks[] = array_column($plan['delete'], 'task_id') === array_map($this->id(...), $expected['delete'] ?? []);
        foreach ($expected['ambiguous'] ?? [] as $index => $tie) {
            $checks[] = ($plan['ambiguous'][$index]['candidates'] ?? []) === array_map($this->id(...), $tie['candidates']);
            $checks[] = ($plan['ambiguous'][$index]['preselected'] ?? null) === $this->id($tie['preselected']);
        }

        return ['commands' => $checks];
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $plan
     * @param  array<string, mixed>  $expected
     * @return array<string, list<bool>>
     */
    private function scoreSkips(array $plan, array $expected): array
    {
        $checks = [];
        foreach ($expected['skipped'] ?? [] as $index => $skip) {
            $checks[] = ($plan['skipped'][$index]['reason'] ?? null) === $skip['reason'] && ($plan['skipped'][$index]['text'] ?? null) === $skip['text'];
        }

        return $checks === [] ? [] : ['safety' => $checks];
    }

    /** Corpus ids ("t1", "project:HCI") become stable UUIDs, as the plan schema requires. */
    private function id(string $value): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, 'agendal-corpus:'.$value)->toString();
    }
}
