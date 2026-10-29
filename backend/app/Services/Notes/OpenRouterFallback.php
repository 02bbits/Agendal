<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Opis\JsonSchema\Validator;
use Throwable;

final class OpenRouterFallback
{
    public const PROMPT_VERSION = 'note-plan-v1';

    public function __construct(private LlmBudget $budget, private PlanValidator $validator, private NoteNamer $namer, private ItemClassifier $classifier, private CommandMatcher $matcher) {}

    /**
     * @param  array<string, mixed>  $rules
     * @param  list<array<string, mixed>>  $tasks
     * @return array<string, mixed>
     */
    public function resolve(array $rules, string $text, NoteContext $context, array $tasks, int $userId): array
    {
        $low = array_values(array_filter($rules['items'], fn (array $item): bool => $item['low']));
        if ($low === [] || ! config('note_llm.enabled')) {
            return $rules;
        }
        $failed = [...$rules, 'engine' => 'rules_fallback'];
        if (! config('note_llm.key') || ! config('note_llm.model')) {
            return $failed;
        }
        $start = hrtime(true);
        $candidateSets = [];
        $input = [];
        foreach ($low as $item) {
            $candidates = [];
            if ($this->classifier->classify($item['text'])['type'] === 'command') {
                $words = $this->matcher->words($item['text'], $context);
                $ranked = $tasks;
                usort($ranked, fn (array $a, array $b): int => $this->matcher->score($words, $b['title']) <=> $this->matcher->score($words, $a['title']));
                $candidates = array_map(fn (array $task): array => ['id' => $task['id'], 'title' => $task['title']], array_slice($ranked, 0, 20));
            }
            $candidateSets[$item['ref']] = array_column($candidates, 'id');
            $input[] = ['ref' => $item['ref'], 'text' => $item['text'], 'candidates' => $candidates];
        }
        $schema = $this->schema(array_column($low, 'ref'), array_values(array_unique(array_merge(...array_values($candidateSets)))), array_values($context->projects));
        $body = [
            'model' => config('note_llm.model'), 'temperature' => 0, 'max_tokens' => config('note_llm.max_completion_tokens'),
            'provider' => ['require_parameters' => true, 'data_collection' => 'deny'],
            'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'plan', 'strict' => true, 'schema' => $schema]],
            'messages' => [
                ['role' => 'system', 'content' => file_get_contents(resource_path('prompts/'.self::PROMPT_VERSION.'.txt'))],
                ['role' => 'user', 'content' => json_encode(['items' => $input, 'now' => $context->local()->format(DATE_ATOM), 'timezone' => $context->timezone, 'projects' => array_values($context->projects)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)],
            ],
        ];
        // UTF-8 bytes upper-bound input token count, including the schema; reserve before sending.
        $reserved = strlen(json_encode($body, JSON_THROW_ON_ERROR)) + (int) config('note_llm.max_completion_tokens');
        try {
            if (! $this->budget->reserve($userId, $reserved)) {
                return $failed;
            }
            $response = Http::withToken((string) config('note_llm.key'))->connectTimeout(1.5)->timeout(1.5)->post('https://openrouter.ai/api/v1/chat/completions', $body);
            if (! $response->successful()) {
                return $failed;
            }
            $data = json_decode((string) $response->json('choices.0.message.content'), flags: JSON_THROW_ON_ERROR);
            if (! (new Validator)->validate($data, json_decode(json_encode($schema, JSON_THROW_ON_ERROR)))->isValid()) {
                return $failed;
            }
            $tokens = max(0, (int) $response->json('usage.total_tokens', $reserved));
            $this->budget->settle($reserved, $tokens);
            $proposals = [];
            foreach ($data->items as $item) {
                if (isset($proposals[$item->ref])) {
                    return $failed;
                }
                $proposals[$item->ref] = (array) $item;
            }
            $plan = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
            $accepted = 0;
            foreach ($rules['items'] as $item) {
                $part = $item['plan'];
                if (isset($proposals[$item['ref']]) && $item['low']) {
                    $proposal = $this->plan($proposals[$item['ref']], $item['text'], $context);
                    $allowed = array_values(array_filter($tasks, fn (array $task): bool => in_array($task['id'], $candidateSets[$item['ref']], true)));
                    $checked = $this->validator->validate($proposal, $context->projects, array_column($allowed, null, 'id'));
                    if ($checked['dropped'] === 0) {
                        $part = $checked;
                        $accepted++;
                    }
                }
                foreach (array_keys($plan) as $key) {
                    $plan[$key] = [...$plan[$key], ...$part[$key]];
                }
            }
            $plan = $this->validator->validate($plan, $context->projects, array_column($tasks, null, 'id'));
            Log::info('note_llm', ['elapsed_ms' => (hrtime(true) - $start) / 1e6, 'tokens' => $tokens, 'accepted' => $accepted]);

            return [...$rules, 'plan' => $plan, 'status' => $this->validator->status($plan), 'name' => $this->namer->name($plan, $text, $context, array_column($tasks, null, 'id')), 'engine' => $accepted > 0 ? 'rules_llm' : 'rules_fallback', 'prompt_version' => self::PROMPT_VERSION];
        } catch (Throwable) {
            Log::info('note_llm', ['elapsed_ms' => (hrtime(true) - $start) / 1e6, 'outcome' => 'fallback']);

            return $failed;
        }
    }

    /**
     * @param  list<string>  $refs
     * @param  list<string>  $ids
     * @param  list<string>  $projects
     * @return array<string, mixed>
     */
    private function schema(array $refs, array $ids, array $projects): array
    {
        $properties = [
            'ref' => ['type' => 'string', 'enum' => $refs], 'action' => ['type' => 'string', 'enum' => ['create', 'complete', 'reschedule', 'delete', 'skip']],
            'task_id' => ['type' => ['string', 'null'], 'enum' => [null, ...$ids]],
            'title' => ['type' => ['string', 'null'], 'maxLength' => 200],
            'due_date' => ['type' => ['string', 'null'], 'format' => 'date'],
            'start_time' => ['type' => ['string', 'null'], 'pattern' => '^([01][0-9]|2[0-3]):[0-5][0-9]$'],
            'end_time' => ['type' => ['string', 'null'], 'pattern' => '^([01][0-9]|2[0-3]):[0-5][0-9]$'],
            'priority' => ['type' => ['string', 'null'], 'enum' => [null, 'low', 'medium', 'high']], 'project' => ['type' => ['string', 'null'], 'enum' => [null, ...$projects]],
            'repeat' => ['type' => 'string', 'enum' => ['never', 'daily', 'weekly', 'monthly']], 'reminder' => ['type' => 'string', 'enum' => ['none', '5m', '15m', '30m', '1h', '1d']],
        ];

        return ['type' => 'object', 'additionalProperties' => false, 'required' => ['items'], 'properties' => [
            'items' => ['type' => 'array', 'maxItems' => count($refs), 'items' => ['type' => 'object', 'additionalProperties' => false, 'required' => array_keys($properties), 'properties' => $properties]],
        ]];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function plan(array $item, string $text, NoteContext $context): array
    {
        $plan = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
        $ref = $item['ref'];
        if ($item['action'] === 'skip') {
            $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => 'skip'];
        } elseif ($item['action'] === 'create') {
            $project = $item['project'] === null ? null : array_search($item['project'], $context->projects, true);
            $plan['create'][] = ['ref' => $ref, 'title' => $item['title'], 'due_date' => $item['due_date'], 'start_time' => $item['start_time'], 'end_time' => $item['end_time'], 'priority' => $item['priority'] ?? 'low', 'project_id' => $project, 'repeat' => $item['repeat'], 'reminder' => $item['reminder'], 'notes' => null, 'duplicate_of' => null];
        } else {
            $entry = ['ref' => $ref, 'task_id' => $item['task_id'], 'label' => $item['action'] === 'complete' ? 'Completed' : ($item['title'] ?? $text)];
            if ($item['action'] === 'complete') {
                $entry['done'] = true;
            } elseif ($item['action'] === 'reschedule') {
                foreach (['due_date', 'start_time', 'end_time'] as $field) {
                    if ($item[$field] !== null) {
                        $entry[$field] = $item[$field];
                    }
                }
            }
            $plan[$item['action'] === 'delete' ? 'delete' : 'update'][] = $entry;
        }

        return $plan;
    }
}
