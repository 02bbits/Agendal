<?php

declare(strict_types=1);

namespace App\Services\Notes;

final class NoteEngine
{
    public function __construct(
        private NoteSplitter $splitter,
        private ItemClassifier $classifier,
        private FieldExtractor $extractor,
        private CommandMatcher $matcher,
        private PlanValidator $validator,
        private NoteNamer $namer,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $tasks
     * @param  list<array<string, mixed>>  $done
     * @return array<string, mixed>
     */
    public function build(string $text, NoteContext $context, array $tasks = [], array $done = [], float $limitMs = 200): array
    {
        $start = hrtime(true);
        $plan = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
        $items = [];
        foreach ($this->splitter->split($text, array_values($context->projects)) as $index => $item) {
            $result = $this->item($item, $context, $tasks, $done, $index + 1, (hrtime(true) - $start) / 1e6 >= $limitMs);
            $items[] = ['text' => $item, ...$result];
            foreach (array_keys($plan) as $key) {
                $plan[$key] = [...$plan[$key], ...$result['plan'][$key]];
            }
        }
        $taskMap = array_column($tasks, null, 'id');
        $plan = $this->validator->validate($plan, $context->projects, $taskMap);

        return ['plan' => $plan, 'status' => $this->validator->status($plan), 'name' => $this->namer->name($plan, $text, $context, $taskMap), 'engine' => 'rules', 'items' => $items];
    }

    /**
     * @param  list<array<string, mixed>>  $tasks
     * @param  list<array<string, mixed>>  $done
     * @return array<string, mixed>
     */
    private function item(string $text, NoteContext $context, array $tasks, array $done, int $index, bool $expired): array
    {
        $plan = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
        $ref = 'i'.$index;
        $type = $expired ? ['type' => 'task', 'action' => null] : $this->classifier->classify($text);
        $low = false;
        if ($type['type'] === 'skip') {
            $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => 'skip'];
        } elseif ($type['type'] === 'command') {
            $matched = $this->matcher->match($text, (string) $type['action'], $tasks, $done, $context);
            if (isset($matched['skip'])) {
                $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => $matched['skip']];
                $low = $matched['skip'] === 'not_found';
            } elseif (isset($matched['create'])) {
                $create = $matched['create'];
                $low = $create['low_confidence'];
                unset($create['low_confidence']);
                $plan['create'][] = ['ref' => $ref, ...$create];
            } else {
                $plan[$matched['kind']][] = ['ref' => $ref, ...$matched['entry']];
                if ($matched['candidates'] !== []) {
                    $plan['ambiguous'][] = ['ref' => $ref, 'candidates' => $matched['candidates'], 'preselected' => $matched['entry']['task_id']];
                }
            }
        } else {
            $create = $expired ? $this->rawTask($text) : $this->extractor->extract($text, $context);
            $low = $create['low_confidence'];
            unset($create['low_confidence']);
            if ($create['title'] === '') {
                $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => 'skip'];
            } else {
                foreach ($tasks as $task) {
                    $words = $this->matcher->words($create['title'], $context);
                    $other = $this->matcher->words($task['title'], $context);
                    if (($task['due_date'] ?? null) === $create['due_date'] && $words !== [] && count($words) === count($other) && array_diff($words, $other) === []) {
                        $create['duplicate_of'] = $task['id'];
                        break;
                    }
                }
                $plan['create'][] = ['ref' => $ref, ...$create];
            }
        }

        return ['ref' => $ref, 'plan' => $plan, 'low' => $low && ! $expired];
    }

    /** @return array<string, mixed> */
    private function rawTask(string $text): array
    {
        $cut = mb_strlen($text) <= 200 ? mb_strlen($text) : (mb_strrpos(mb_substr($text, 0, 201), ' ') ?: 200);

        return ['title' => mb_substr($text, 0, $cut), 'due_date' => null, 'start_time' => null, 'end_time' => null, 'priority' => 'low', 'project_id' => null, 'repeat' => 'never', 'reminder' => 'none', 'notes' => trim(mb_substr($text, $cut)) ?: null, 'duplicate_of' => null, 'low_confidence' => false];
    }
}
