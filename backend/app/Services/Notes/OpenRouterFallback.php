<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\ItemKind;
use App\Enums\NoteEngineKind;
use App\Enums\Priority;
use App\Enums\ProposedAction;
use App\Enums\Reminder;
use App\Enums\Repeat;
use App\Enums\SkipReason;
use BackedEnum;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Opis\JsonSchema\Validator;
use Throwable;
use UnexpectedValueException;

/**
 * ADR-008: asks the model about low-confidence items only, with minimum context, schema-only output and
 * budgets. Each proposal is validated like a rules plan; a failing one leaves that item's rules result.
 *
 * @phpstan-import-type TaskRow from CommandMatcher
 * @phpstan-import-type ValidatedPlan from PlanValidator
 */
final class OpenRouterFallback
{
    private const PLAN_KINDS = ['create', 'update', 'delete', 'skipped', 'ambiguous'];

    private const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

    public function __construct(
        private LlmBudget $budget,
        private PlanValidator $validator,
        private NoteNamer $namer,
        private ItemClassifier $classifier,
        private CommandMatcher $matcher,
        private TaskSchedule $schedule,
    ) {}

    /** @param list<TaskRow> $openTasks */
    public function improve(NoteBuild $rules, string $text, NoteContext $context, array $openTasks, int $userId): NoteBuild
    {
        if ($rules->lowConfidence === [] || ! config('note_llm.enabled')) {
            return $rules;
        }
        if (! config('note_llm.key') || ! config('note_llm.model')) {
            return $rules->asFallback();
        }
        $started = hrtime(true);
        $candidates = array_map(fn (string $item): array => $this->candidatesFor($item, $context, $openTasks), $rules->lowConfidence);
        $schema = $this->schema(array_keys($rules->lowConfidence), $candidates, array_values($context->projects));
        $body = $this->request($rules->lowConfidence, $candidates, $schema, $context);
        // UTF-8 bytes bound the input tokens, schema included; reserve them before sending.
        $reserved = strlen(json_encode($body, JSON_THROW_ON_ERROR)) + (int) config('note_llm.max_completion_tokens');
        if (! $this->budget->reserve($userId, $reserved)) {
            return $rules->asFallback();
        }
        try {
            $proposals = $this->proposals($this->send($body), $schema, $reserved);
        } catch (Throwable) {
            Log::info('note_llm', ['elapsed_ms' => $this->elapsedMs($started), 'outcome' => 'fallback']);

            return $rules->asFallback();
        }
        [$plan, $accepted] = $this->merge($rules, $proposals, $candidates, $context);
        $tasksById = array_column($openTasks, null, 'id');
        $validated = $this->validator->validate($plan, $context->projects, $tasksById);
        Log::info('note_llm', ['elapsed_ms' => $this->elapsedMs($started), 'accepted' => $accepted]);

        return new NoteBuild(
            $validated,
            $this->validator->status($validated),
            $this->namer->name($validated, $text, $context, $tasksById),
            $accepted > 0 ? NoteEngineKind::RulesWithLlm : NoteEngineKind::RulesFallback,
            $rules->lowConfidence,
            (string) config('note_llm.prompt_version'),
        );
    }

    /**
     * A command-like item may show the model its best-scoring open tasks, by opaque id and title only.
     *
     * @param  list<TaskRow>  $openTasks
     * @return list<TaskRow>
     */
    private function candidatesFor(string $item, NoteContext $context, array $openTasks): array
    {
        if ($this->classifier->classify($item, $context)->kind !== ItemKind::Command) {
            return [];
        }
        $words = $this->matcher->words($item, $context);
        usort($openTasks, fn (array $a, array $b): int => $this->matcher->score($words, $b['title']) <=> $this->matcher->score($words, $a['title']));

        return array_slice($openTasks, 0, (int) config('note_llm.candidate_limit'));
    }

    /**
     * The schema lists the supplied refs, candidate ids and project names, so the model can name nothing else.
     *
     * @param  list<string>  $refs
     * @param  array<string, list<TaskRow>>  $candidates
     * @param  list<string>  $projects
     * @return array<string, mixed>
     */
    private function schema(array $refs, array $candidates, array $projects): array
    {
        $ids = array_values(array_unique(array_merge([], ...array_map(fn (array $tasks): array => array_column($tasks, 'id'), array_values($candidates)))));
        $values = fn (array $cases): array => array_map(fn (BackedEnum $case): string => (string) $case->value, $cases);
        $time = ['type' => ['string', 'null'], 'pattern' => self::TIME_PATTERN];
        $properties = [
            'ref' => ['type' => 'string', 'enum' => $refs],
            'action' => ['type' => 'string', 'enum' => $values(ProposedAction::cases())],
            'task_id' => ['type' => ['string', 'null'], 'enum' => [null, ...$ids]],
            'title' => ['type' => ['string', 'null'], 'maxLength' => (int) config('notes.title_limit')],
            'due_date' => ['type' => ['string', 'null'], 'format' => 'date'],
            'start_time' => $time,
            'end_time' => $time,
            'priority' => ['type' => ['string', 'null'], 'enum' => [null, ...$values(Priority::cases())]],
            'project' => ['type' => ['string', 'null'], 'enum' => [null, ...$projects]],
            'repeat' => ['type' => 'string', 'enum' => $values(Repeat::cases())],
            'reminder' => ['type' => 'string', 'enum' => $values(Reminder::cases())],
        ];

        return ['type' => 'object', 'additionalProperties' => false, 'required' => ['items'], 'properties' => [
            'items' => ['type' => 'array', 'maxItems' => count($refs), 'items' => [
                'type' => 'object', 'additionalProperties' => false, 'required' => array_keys($properties), 'properties' => $properties,
            ]],
        ]];
    }

    /**
     * Only the low-confidence items, now, the zone, project names and candidate titles: no email, name,
     * note id or task notes (ADR-008 privacy).
     *
     * @param  array<string, string>  $items
     * @param  array<string, list<TaskRow>>  $candidates
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    private function request(array $items, array $candidates, array $schema, NoteContext $context): array
    {
        $input = [];
        foreach ($items as $ref => $text) {
            $input[] = ['ref' => $ref, 'text' => $text, 'candidates' => array_map(fn (array $task): array => ['id' => $task['id'], 'title' => $task['title']], $candidates[$ref])];
        }
        $prompt = (string) file_get_contents(resource_path('prompts/'.config('note_llm.prompt_version').'.txt'));
        $userContent = ['items' => $input, 'now' => $context->local()->format(DATE_ATOM), 'timezone' => $context->timezone, 'projects' => array_values($context->projects)];

        return [
            'model' => config('note_llm.model'),
            'temperature' => 0,
            'max_tokens' => (int) config('note_llm.max_completion_tokens'),
            'provider' => ['require_parameters' => true, 'data_collection' => 'deny'],
            'response_format' => ['type' => 'json_schema', 'json_schema' => ['name' => 'plan', 'strict' => true, 'schema' => $schema]],
            'messages' => [
                ['role' => 'system', 'content' => $prompt],
                ['role' => 'user', 'content' => json_encode($userContent, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)],
            ],
        ];
    }

    /** @param array<string, mixed> $body */
    private function send(array $body): Response
    {
        $timeout = (float) config('note_llm.timeout_seconds');

        return Http::withToken((string) config('note_llm.key'))->connectTimeout($timeout)->timeout($timeout)
            ->post((string) config('note_llm.url'), $body)->throw();
    }

    /**
     * One proposal per ref, valid against the schema; anything else throws and the rules result stands.
     *
     * @param  array<string, mixed>  $schema
     * @return array<string, array<string, mixed>>
     */
    private function proposals(Response $response, array $schema, int $reserved): array
    {
        $this->budget->settle($reserved, max(0, (int) $response->json('usage.total_tokens', $reserved)));
        $data = json_decode((string) $response->json('choices.0.message.content'), flags: JSON_THROW_ON_ERROR);
        if (! (new Validator)->validate($data, json_decode(json_encode($schema, JSON_THROW_ON_ERROR)))->isValid()) {
            throw new UnexpectedValueException('The model output breaks the plan schema');
        }
        $proposals = [];
        foreach ($data->items as $item) {
            if (isset($proposals[$item->ref])) {
                throw new UnexpectedValueException('The model proposed one ref twice');
            }
            $proposals[$item->ref] = (array) $item;
        }

        return $proposals;
    }

    /**
     * Each proposal that validates on its own, against its own candidates, replaces that item's rules entries.
     *
     * @param  array<string, array<string, mixed>>  $proposals
     * @param  array<string, list<TaskRow>>  $candidates
     * @return array{0: array<string, list<array<string, mixed>>>, 1: int}
     */
    private function merge(NoteBuild $rules, array $proposals, array $candidates, NoteContext $context): array
    {
        $plan = array_intersect_key($rules->plan, array_flip(self::PLAN_KINDS));
        $accepted = 0;
        foreach ($proposals as $ref => $proposal) {
            $allowed = array_column($candidates[$ref] ?? [], null, 'id');
            $part = $this->validator->validate($this->proposalPlan($proposal, $rules->lowConfidence[$ref] ?? '', $allowed, $context), $context->projects, $allowed);
            if ($part['dropped'] > 0) {
                continue;
            }
            foreach (self::PLAN_KINDS as $kind) {
                $kept = array_values(array_filter($plan[$kind], fn (array $entry): bool => ($entry['ref'] ?? null) !== $ref));
                $plan[$kind] = [...$kept, ...$part[$kind]];
            }
            $accepted++;
        }

        return [$plan, $accepted];
    }

    /**
     * @param  array<string, mixed>  $proposal
     * @param  array<string, TaskRow>  $allowed
     * @return array<string, list<array<string, mixed>>>
     */
    private function proposalPlan(array $proposal, string $text, array $allowed, NoteContext $context): array
    {
        $plan = array_fill_keys(self::PLAN_KINDS, []);
        $ref = $proposal['ref'];
        $action = ProposedAction::from($proposal['action']);
        if ($action === ProposedAction::Skip) {
            $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => SkipReason::Skip->value];

            return $plan;
        }
        if ($action === ProposedAction::Create) {
            $projectId = $proposal['project'] === null ? null : array_search($proposal['project'], $context->projects, true);
            $plan['create'][] = [
                'ref' => $ref, 'title' => $proposal['title'], 'due_date' => $proposal['due_date'],
                'start_time' => $proposal['start_time'], 'end_time' => $proposal['end_time'],
                'priority' => $proposal['priority'] ?? Priority::Low->value, 'project_id' => $projectId === false ? null : $projectId,
                'repeat' => $proposal['repeat'], 'reminder' => $proposal['reminder'], 'notes' => null, 'duplicate_of' => null,
            ];

            return $plan;
        }
        $task = $allowed[$proposal['task_id']] ?? null;
        $entry = ['ref' => $ref, 'task_id' => $proposal['task_id'], 'label' => $task['title'] ?? $text];
        if ($action === ProposedAction::Complete) {
            $entry = [...$entry, 'label' => __('notes.label.completed'), 'done' => true];
        }
        if ($action === ProposedAction::Reschedule) {
            $entry = [...$entry, ...array_filter(array_intersect_key($proposal, array_flip(['due_date', 'start_time', 'end_time'])), fn (mixed $value): bool => $value !== null)];
            if (isset($entry['due_date'])) {
                $entry['label'] = $this->schedule->dueLabel($entry['due_date'], $task['due_date'] ?? null, $context);
            }
        }
        $plan[$action === ProposedAction::Delete ? 'delete' : 'update'][] = $entry;

        return $plan;
    }

    private function elapsedMs(int $started): float
    {
        return (hrtime(true) - $started) / 1e6;
    }
}
