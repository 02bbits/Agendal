<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\NoteEngineKind;
use App\Enums\Priority;
use App\Enums\ProposedAction;
use App\Enums\Reminder;
use App\Enums\Repeat;
use App\Enums\SkipReason;
use App\Services\Tasks\RepeatSchedule;
use BackedEnum;
use DateTimeImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use JsonException;
use Opis\JsonSchema\Validator;
use SensitiveParameter;
use Throwable;
use UnexpectedValueException;

/**
 * ADR-008: asks the app's language model about low-confidence items only, with minimum context, schema-only output
 * and budgets. Each proposal is validated like a rules plan; unresolved writes are held for follow-up.
 *
 * @phpstan-import-type TaskRow from CommandMatcher
 * @phpstan-import-type ValidatedPlan from PlanValidator
 *
 * @phpstan-type Route array{url: string, key: string, model: string, output: string, sdk: bool}
 */
final class NoteLlmFallback
{
    private const PLAN_KINDS = ['create', 'update', 'delete', 'skipped', 'ambiguous'];

    private const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

    public function __construct(
        private LlmBudget $budget,
        private PlanValidator $validator,
        private NoteNamer $namer,
        private CommandMatcher $matcher,
        private FieldExtractor $extractor,
        private ClaudeMessages $claude,
    ) {}

    /**
     * @param  list<TaskRow>  $openTasks
     */
    public function improve(NoteBuild $rules, string $text, NoteContext $context, array $openTasks, int $userId): NoteBuild
    {
        if ($rules->lowConfidence === []) {
            return $rules;
        }
        $route = $this->route();
        if ($route === null) {
            return $rules;
        }
        $started = hrtime(true);
        try {
            $items = $rules->lowConfidence;
            $candidates = [];
            foreach ($items as $ref => $item) {
                $knownIds = array_column(array_filter([...$rules->plan['update'], ...$rules->plan['delete']],
                    fn (array $entry): bool => NoteEngine::itemIndex($entry['ref']) === NoteEngine::itemIndex($ref)
                        && ! array_key_exists($entry['ref'], $items)), 'task_id');
                $remaining = array_values(array_filter($openTasks, fn (array $task): bool => ! in_array($task['id'], $knownIds, true)));
                // ADR-008: open-task titles go out for command-like items only; a new task must not borrow one
                $candidates[$ref] = $this->commandLike($item) ? $this->candidatesFor($item, $context, $remaining) : [];
            }
            $schema = $this->schema(array_keys($items), $candidates, array_values($context->projects));
            $body = $this->request($items, $candidates, $schema, $context, $route);
            // UTF-8 bytes bound the input tokens, schema included; reserve them before sending.
            $reserved = strlen(json_encode($body, JSON_THROW_ON_ERROR)) + (int) config('note_llm.max_completion_tokens');
            $reservationDay = $this->budget->reserve($userId, $reserved);
            if ($reservationDay === false) {
                return $this->failed($rules, 'budget_exhausted');
            }
            $answer = $this->send($body, $route);
            $this->budget->settle($reserved, max(0, $answer['tokens'] ?? $reserved), $reservationDay);
            $proposals = $this->proposals($answer['content'], $schema);
            [$plan, $accepted, $outcomes] = $this->merge($rules, $proposals, $candidates, $context);
            Log::info('note_llm', ['elapsed_ms' => $this->elapsedMs($started), 'accepted' => $accepted]);

            return $this->finish($rules, $plan, $outcomes, $text, $context, $openTasks, $accepted);
        } catch (Throwable $exception) {
            Log::info('note_llm', ['elapsed_ms' => $this->elapsedMs($started), 'outcome' => 'fallback']);

            $reason = match (true) {
                $exception instanceof ConnectionException => 'connection_failed_or_timeout',
                $exception instanceof RequestException => 'http_'.$exception->response->status(),
                $exception instanceof UnexpectedValueException, $exception instanceof JsonException => 'invalid_response',
                default => 'fallback_error',
            };

            return $this->failed($rules, $reason);
        }
    }

    /**
     * The app's provider from config, with its cheapest model unless NOTE_LLM_MODEL names one. Null keeps the rules
     * result: the kill switch (ADR-008), an unknown provider, or no key.
     *
     * @return Route|null
     */
    private function route(): ?array
    {
        $config = config('note_llm.providers')[(string) config('note_llm.provider')] ?? null;
        if (! config('note_llm.enabled') || ! is_array($config)) {
            return null;
        }
        $key = $this->key();
        if ($key === null) {
            return null;
        }

        return ['url' => (string) ($config['url'] ?? ''), 'key' => $key, 'model' => (string) (config('note_llm.model') ?: $config['model']),
            'output' => (string) ($config['output'] ?? 'json_schema'), 'sdk' => isset($config['sdk'])];
    }

    /**
     * The provider key: from the secret file when one is set (an unreadable or empty file turns the model off rather
     * than falling back to the variable), else from the environment.
     */
    private function key(): ?string
    {
        $file = config('note_llm.key_file');
        if (is_string($file) && $file !== '') {
            $key = is_file($file) && is_readable($file) ? trim((string) file_get_contents($file)) : '';
            if ($key === '') {
                Log::warning('note_llm', ['outcome' => 'key_file_unreadable']);
            }

            return $key === '' ? null : $key;
        }
        $key = config('note_llm.key');

        return is_string($key) && $key !== '' ? $key : null;
    }

    /** Timeout, error or spent budget: the rules result stands, recorded as rules_fallback (ADR-008). */
    private function failed(NoteBuild $rules, string $reason): NoteBuild
    {
        $outcomes = array_fill_keys(array_keys($rules->lowConfidence), ['source' => 'pending', 'status' => 'unavailable', 'reason' => $reason]);

        return new NoteBuild($rules->plan, $rules->status, $rules->name, NoteEngineKind::RulesFallback,
            $rules->lowConfidence, (string) config('note_llm.prompt_version'), $outcomes);
    }

    /**
     * Items without an accepted proposal keep their rules entries: an invalid or missing proposal falls back to
     * the rules result for that item (ADR-008).
     *
     * @param  array<string, mixed>  $plan
     * @param  array<string, array{source: string, status: string, reason: string, field_sources?: array<string, string>}>  $outcomes
     * @param  list<TaskRow>  $tasks
     */
    private function finish(NoteBuild $rules, array $plan, array $outcomes, string $text, NoteContext $context, array $tasks, int $accepted): NoteBuild
    {
        $tasksById = array_column($tasks, null, 'id');
        $validated = $this->validator->validate($plan, $context->projects, $tasksById);

        return new NoteBuild($validated, $this->validator->status($validated),
            $this->namer->name($validated, $text, $context, $tasksById),
            $accepted > 0 ? NoteEngineKind::RulesWithLlm : NoteEngineKind::RulesFallback,
            $rules->lowConfidence, (string) config('note_llm.prompt_version'), $outcomes);
    }

    private function replacesRef(string $entryRef, string $ref, NoteBuild $rules): bool
    {
        if ($entryRef === $ref) {
            return true;
        }
        if (! str_starts_with($entryRef, $ref.'-')) {
            return false;
        }
        foreach ([...$rules->plan['update'], ...$rules->plan['delete']] as $entry) {
            if (NoteEngine::itemIndex($entry['ref']) === NoteEngine::itemIndex($ref) && ! array_key_exists($entry['ref'], $rules->lowConfidence)) {
                return false;
            }
        }
        foreach (array_keys($rules->lowConfidence) as $other) {
            if ($other !== $ref && NoteEngine::itemIndex($other) === NoteEngine::itemIndex($ref)) {
                return false;
            }
        }

        return true;
    }

    /**
     * A complete, move or delete word from the rules, compared without accents so "xoa call mum" and
     * "doi call mum sang thu tu" count while "goi me thu 6" does not.
     */
    private function commandLike(string $item): bool
    {
        $words = array_map(fn (string $word): string => preg_quote($word, '~'), $this->commandWords());

        return preg_match('~(?<![\p{L}\p{N}])(?:'.implode('|', $words).')(?![\p{L}\p{N}])~u', Str::lower(Str::ascii($item))) === 1;
    }

    /** @return list<string> the complete, move and delete words, without accents */
    private function commandWords(): array
    {
        return array_map(fn (string $word): string => Str::lower(Str::ascii($word)),
            [...NoteVocabulary::values('complete_command'), ...NoteVocabulary::values('move_command'), ...NoteVocabulary::values('delete_command')]);
    }

    /**
     * An uncertain item may show relevant open tasks even when its command verb was not recognized.
     *
     * @param  list<TaskRow>  $openTasks
     * @return list<TaskRow>
     */
    private function candidatesFor(string $item, NoteContext $context, array $openTasks): array
    {
        // An unaccented command word is no name word: "bo" (bỏ) in "bo qua dinh dang" must not pick "Chạy bộ".
        $words = array_values(array_diff(NoteVocabulary::tokens(Str::ascii(implode(' ', $this->matcher->words($item, $context)))),
            array_filter($this->commandWords(), fn (string $word): bool => ! str_contains($word, ' '))));
        $score = fn (array $task): float => $this->matcher->score($words, Str::ascii($task['title']));
        // Uncertain intent may be an unrecognized command. Supply only relevant, already user-scoped tasks.
        $openTasks = array_values(array_filter($openTasks, fn (array $task): bool => $score($task) > 0));
        usort($openTasks, fn (array $a, array $b): int => $score($b) <=> $score($a));

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
            'repeat_rule' => ['type' => ['string', 'null'], 'maxLength' => 300,
                'description' => 'Optional RRULE matching repeat. FREQ must be first. Only FREQ, INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, WKST, COUNT and UNTIL; no DTSTART.'],
            'copies' => ['type' => 'integer', 'minimum' => 1, 'maximum' => (int) config('notes.max_items'),
                'description' => 'Independent copies of a create action; 1 for other actions. Never invent times for multiple daily copies.'],
            'reminder' => ['type' => 'string', 'enum' => $values(Reminder::cases())],
        ];

        return ['type' => 'object', 'additionalProperties' => false, 'required' => ['items'], 'properties' => [
            // An item may hold several tasks ("call the bank, and the report is due friday"): one create each.
            'items' => ['type' => 'array', 'maxItems' => (int) config('notes.max_items'), 'items' => [
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
     * @param  Route  $route
     * @return array<string, mixed>
     */
    private function request(array $items, array $candidates, array $schema, NoteContext $context, array $route): array
    {
        $input = [];
        foreach ($items as $ref => $text) {
            $input[] = ['ref' => $ref, 'text' => $text,
                'known_fields' => (object) $this->extractor->extract($text, $context)->trustedFields,
                'candidates' => array_map(fn (array $task): array => ['id' => $task['id'], 'title' => $task['title']], $candidates[$ref])];
        }
        $prompt = (string) file_get_contents(resource_path('prompts/'.config('note_llm.prompt_version').'.txt'));
        $userContent = ['items' => $input, 'now' => $context->local()->format(DATE_ATOM), 'timezone' => $context->timezone, 'projects' => array_values($context->projects)];

        $bounded = self::withoutBounds($schema);
        if ($route['output'] === 'json_object') {
            // JSON mode only checks that the answer is JSON: the schema goes in the prompt, and proposals() checks it.
            $prompt .= "\n\nReturn only JSON that matches this JSON schema:\n".json_encode($bounded, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        }

        return [
            'model' => $route['model'],
            'temperature' => 0,
            'max_tokens' => (int) config('note_llm.max_completion_tokens'),
            'response_format' => $route['output'] === 'json_object' ? ['type' => 'json_object']
                : ['type' => 'json_schema', 'json_schema' => ['name' => 'plan', 'strict' => true, 'schema' => $bounded]],
            'messages' => [
                ['role' => 'system', 'content' => $prompt],
                ['role' => 'user', 'content' => json_encode($userContent, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)],
            ],
        ];
    }

    /**
     * Gemini refuses a long note's schema as "too many states" because of length, size, range, pattern and format
     * bounds. It gets the same shape without them; the full schema still checks its answer in proposals().
     *
     * @param  array<string, mixed>  $schema
     * @return array<string, mixed>
     */
    private static function withoutBounds(array $schema): array
    {
        $schema = array_diff_key($schema, array_flip(['maxLength', 'minimum', 'maximum', 'pattern', 'format', 'maxItems']));

        return array_map(fn (mixed $value): mixed => is_array($value) ? self::withoutBounds($value) : $value, $schema);
    }

    /**
     * The model's JSON answer and the tokens it used.
     *
     * @param  array<string, mixed>  $body
     * @param  Route  $route
     * @return array{content: string, tokens: int|null}
     */
    private function send(array $body, #[SensitiveParameter] array $route): array
    {
        $timeout = (float) config('note_llm.timeout_seconds');
        if ($route['sdk']) {
            // The same prompt, note items and bounds-free schema, as a Claude Messages request.
            return $this->claude->plan($route['key'], $route['model'], (string) $body['messages'][0]['content'],
                (string) $body['messages'][1]['content'], $body['response_format']['json_schema']['schema'], $timeout);
        }

        // One retry when the provider is busy (429, 503); anything else falls back to the rules at once
        $response = Http::withToken($route['key'])->connectTimeout($timeout)->timeout($timeout)
            ->retry(2, 500, fn (Throwable $e): bool => $e instanceof RequestException && in_array($e->response->status(), [429, 503], true))
            ->post($route['url'], $body)->throw();
        $tokens = $response->json('usage.total_tokens');

        return ['content' => (string) $response->json('choices.0.message.content'), 'tokens' => is_numeric($tokens) ? (int) $tokens : null];
    }

    /**
     * One proposal per ref, valid against the schema; anything else throws and the rules result stands.
     *
     * @param  array<string, mixed>  $schema
     * @return array<string, list<array<string, mixed>>>
     */
    private function proposals(string $answer, array $schema): array
    {
        $data = json_decode($answer, flags: JSON_THROW_ON_ERROR);
        if (! (new Validator)->validate($data, json_decode(json_encode($schema, JSON_THROW_ON_ERROR)))->isValid()) {
            throw new UnexpectedValueException('The model output breaks the plan schema');
        }
        $proposals = [];
        foreach ($data->items as $item) {
            $proposals[$item->ref][] = (array) $item;
        }

        return $proposals;
    }

    /**
     * Each proposal that validates on its own, against its own candidates, replaces that item's rules entries.
     * Entries stay in the note's item order (i1, i2, …).
     *
     * @param  array<string, list<array<string, mixed>>>  $proposals
     * @param  array<string, list<TaskRow>>  $candidates
     * @return array{0: array<string, mixed>, 1: int, 2: array<string, array{source: string, status: string, reason: string, field_sources?: array<string, string>}>}
     */
    private function merge(NoteBuild $rules, array $proposals, array $candidates, NoteContext $context): array
    {
        $plan = array_intersect_key($rules->plan, array_flip([...self::PLAN_KINDS, 'needs_confirm']));
        $accepted = 0;
        $outcomes = array_fill_keys(array_keys($rules->lowConfidence), ['source' => 'pending', 'status' => 'missing', 'reason' => 'no_proposal']);
        foreach ($proposals as $ref => $list) {
            $allowed = array_column($candidates[$ref] ?? [], null, 'id');
            $original = $rules->lowConfidence[$ref] ?? '';
            $fieldSources = ['action' => 'llm'];
            $proposal = $list[0];
            $several = count($list) > 1;
            // Several proposals for one item are only separate new tasks; a copy or a change there has no single target.
            if ($several && array_filter($list, fn (array $one): bool => $one['action'] !== ProposedAction::Create->value || $one['copies'] !== 1) !== []) {
                $outcomes[$ref] = ['source' => 'pending', 'status' => 'rejected', 'reason' => 'invalid_proposal'];

                continue;
            }
            // The rules read one date, time or priority for the whole item; with several tasks it is no one task's.
            if (! $several && in_array($proposal['action'], [ProposedAction::Create->value, ProposedAction::Reschedule->value], true)) {
                $known = $this->extractor->extract($original, $context)->trustedFields;
                $modelDate = $proposal['due_date'];
                if ($proposal['action'] === ProposedAction::Reschedule->value) {
                    $known = array_intersect_key($known, array_flip(['due_date', 'start_time', 'end_time']));
                }
                foreach ($known as $field => $value) {
                    $proposal[$field] = $value;
                    $fieldSources[$field] = 'rules';
                }
                if (isset($known['due_date']) && $known['due_date'] !== $modelDate && ! isset($known['priority']) && $proposal['priority'] !== Priority::High->value) {
                    $proposal['priority'] = null;
                }
            }
            $proposed = $this->proposalPlan([...$proposal, 'ref' => $ref], $original, $allowed, $context);
            // The second and later tasks of one item get the item's ref with -2, -3, like the copies of a create.
            foreach (array_slice($list, 1) as $index => $more) {
                $extra = $proposed === null ? null : $this->proposalPlan([...$more, 'ref' => $ref.'-'.($index + 2)], $original, $allowed, $context);
                $proposed = $extra === null ? null : array_merge_recursive($proposed, $extra);
            }
            if ($proposed === null) {
                $outcomes[$ref] = ['source' => 'pending', 'status' => 'rejected', 'reason' => 'invalid_proposal'];

                continue;
            }
            $part = $this->validator->validate($proposed, $context->projects, $allowed);
            if ($part['dropped'] > 0) {
                $outcomes[$ref] = ['source' => 'pending', 'status' => 'rejected', 'reason' => 'validation_failed'];

                continue;
            }
            $replacement = $plan;
            foreach (self::PLAN_KINDS as $kind) {
                // Replace all create copies, but only the unresolved clause of a multi-target command.
                $kept = array_values(array_filter($plan[$kind], fn (array $entry): bool => ! $this->replacesRef($entry['ref'], $ref, $rules)));
                $replacement[$kind] = [...$kept, ...$part[$kind]];
            }
            if (count($replacement['create']) > (int) config('notes.max_items')) {
                $outcomes[$ref] = ['source' => 'pending', 'status' => 'rejected', 'reason' => 'item_limit'];

                continue;
            }
            $plan = $replacement;
            $accepted++;
            $skip = $part['skipped'][0]['reason'] ?? null;
            $status = match ($skip) {
                SkipReason::Unclear->value => 'unclear',
                SkipReason::Skip->value => 'skipped',
                default => 'accepted',
            };
            $changedEntry = $part['create'][0] ?? $part['update'][0] ?? $part['delete'][0] ?? null;
            if ($part['create'] !== []) {
                $fieldSources['title'] = 'llm';
            }
            if ($changedEntry !== null) {
                if (isset($changedEntry['task_id'])) {
                    $fieldSources['task_id'] = 'llm';
                }
                foreach (['due_date', 'start_time', 'end_time', 'repeat', 'repeat_rule', 'priority', 'reminder'] as $field) {
                    $value = $changedEntry[$field] ?? null;
                    if (! isset($fieldSources[$field]) && $value !== null) {
                        $fieldSources[$field] = $value === ($proposal[$field] ?? null) ? 'llm' : 'server';
                    }
                }
            }
            $mixed = in_array('rules', $fieldSources, true) || in_array('server', $fieldSources, true);
            $outcomes[$ref] = ['source' => $mixed ? 'mixed' : 'llm', 'status' => $status, 'reason' => $skip ?? 'validated', 'field_sources' => $fieldSources];
        }
        foreach (self::PLAN_KINDS as $kind) {
            usort($plan[$kind], fn (array $a, array $b): int => strnatcmp((string) ($a['ref'] ?? ''), (string) ($b['ref'] ?? '')));
        }

        return [$plan, $accepted, $outcomes];
    }

    /**
     * @param  array<string, mixed>  $proposal
     * @param  array<string, TaskRow>  $allowed
     * @return array<string, list<array<string, mixed>>>|null null rejects the proposal and holds that target
     */
    private function proposalPlan(array $proposal, string $text, array $allowed, NoteContext $context): ?array
    {
        $plan = array_fill_keys(self::PLAN_KINDS, []);
        $ref = $proposal['ref'];
        $action = ProposedAction::from($proposal['action']);
        if ($action !== ProposedAction::Create && ($proposal['copies'] !== 1 || $proposal['repeat_rule'] !== null)) {
            return null;
        }
        $unresolved = $this->extractor->hasUnresolvedReference($text, $context) && $allowed === [];
        if ($action === ProposedAction::Unclear || $unresolved
            || ($action === ProposedAction::Create && is_string($proposal['title']) && $this->extractor->hasUnresolvedReference($proposal['title'], $context))) {
            $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => SkipReason::Unclear->value];

            return $plan;
        }
        if ($action === ProposedAction::Skip) {
            $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => SkipReason::Skip->value];

            return $plan;
        }
        if ($action === ProposedAction::Create) {
            if ($proposal['task_id'] !== null || ! is_string($proposal['title']) || ! RepeatSchedule::validFor($proposal['repeat_rule'], $proposal['repeat'])
                || ($proposal['copies'] > 1 && $proposal['start_time'] !== null)) {
                return null;
            }
            $dueDate = $proposal['due_date'];
            if ($dueDate === null && ($proposal['start_time'] !== null || $proposal['repeat'] !== Repeat::Never->value)) {
                $passed = $proposal['start_time'] !== null && $proposal['start_time'] <= $context->clock();
                $dueDate = $context->today()->modify($passed ? '+1 day' : '+0 days')->format('Y-m-d');
            }
            if ($proposal['repeat_rule'] !== null) {
                assert($dueDate !== null);
                // Match the rules engine: align the first occurrence before starting its requested interval.
                $firstRule = (string) preg_replace('/;INTERVAL=\d+/', ';INTERVAL=1', $proposal['repeat_rule']);
                $dueDate = RepeatSchedule::onOrAfter($firstRule, $dueDate, $dueDate);
                if ($dueDate === null) {
                    return null;
                }
            }
            $projectId = $proposal['project'] === null ? null : array_search($proposal['project'], $context->projects, true);
            $defaults = $this->extractor->scheduleDefaults($text, $dueDate, $proposal['start_time'], $context);
            // A changed/inferred date invalidates a model's date-dependent default priority. A model "none"
            // reminder supplies no reminder override; the same server defaults as rules still apply.
            $priority = $proposal['priority'];
            if ($priority === null || ($dueDate !== $proposal['due_date'] && $priority !== Priority::High->value)) {
                $priority = $defaults['priority'];
            }
            $reminder = $proposal['reminder'] === Reminder::None->value ? $defaults['reminder'] : $proposal['reminder'];
            $entry = [
                'ref' => $ref, 'title' => $this->extractor->cased(trim($proposal['title']), $context), 'due_date' => $dueDate,
                'start_time' => $proposal['start_time'], 'end_time' => $proposal['end_time'],
                'priority' => $priority, 'project_id' => $projectId === false ? null : $projectId,
                'repeat' => $proposal['repeat'], 'reminder' => $reminder, 'notes' => null, 'duplicate_of' => null,
                ...($proposal['repeat_rule'] === null ? [] : ['repeat_rule' => $proposal['repeat_rule']]),
            ];
            $plan['create'] = NoteCopies::expand($entry, $proposal['copies']);

            return $plan;
        }
        $task = $allowed[$proposal['task_id']] ?? null;
        if ($task === null) {
            return null;
        }
        $entry = ['ref' => $ref, 'task_id' => $proposal['task_id'], 'label' => $task['title']];
        if ($action === ProposedAction::Complete) {
            $entry = [...$entry, 'label' => __('notes.label.completed'), 'done' => true];
        }
        if ($action === ProposedAction::Reschedule) {
            $stated = array_filter(array_intersect_key($proposal, array_flip(['due_date', 'start_time', 'end_time'])), fn (mixed $value): bool => $value !== null);
            if ($stated === []) {
                return null;
            }
            $fields = $this->rescheduleFields($stated, $task, $context);
            if ($fields === []) {
                $plan['skipped'][] = ['ref' => $ref, 'text' => $text, 'reason' => SkipReason::NoChange->value];

                return $plan;
            }
            $date = $fields['due_date'] ?? $task['due_date'] ?? null;
            $day = $date === null ? '' : (new DateTimeImmutable($date))->format(__('notes.label.date_format'));
            $when = trim($day.' '.($fields['start_time'] ?? $task['start_time'] ?? ''));
            $entry = [...$entry, ...$fields, 'label' => __('notes.label.due', ['when' => $when])];
        }
        $plan[$action === ProposedAction::Delete ? 'delete' : 'update'][] = $entry;

        return $plan;
    }

    /**
     * Model dates and times follow NU-E5, NU-E35 and TK-3 too: infer a date for a time, keep the duration and
     * omit unchanged values. Null from the model means unknown, while an end moved past midnight is cleared.
     *
     * @param  array<string, mixed>  $fields
     * @param  TaskRow  $task
     * @return array<string, mixed>
     */
    private function rescheduleFields(array $fields, array $task, NoteContext $context): array
    {
        if (isset($fields['start_time'])) {
            if (! isset($fields['due_date']) && ! isset($task['due_date'])) {
                $day = $fields['start_time'] <= $context->clock() ? $context->today()->modify('+1 day') : $context->today();
                $fields['due_date'] = $day->format('Y-m-d');
            }
            if (! isset($fields['end_time']) && isset($task['start_time'], $task['end_time'])) {
                $duration = NoteDurations::clockMinutes($task['end_time']) - NoteDurations::clockMinutes($task['start_time']);
                $fields['end_time'] = $duration <= 0 ? null : NoteDurations::clockTime(NoteDurations::clockMinutes($fields['start_time']) + $duration);
            }
        }

        return array_filter($fields, fn (mixed $value, string $key): bool => $value !== ($task[$key] ?? null), ARRAY_FILTER_USE_BOTH);
    }

    private function elapsedMs(int $started): float
    {
        return (hrtime(true) - $started) / 1e6;
    }
}
