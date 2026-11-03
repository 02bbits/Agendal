<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\ItemKind;
use App\Enums\NoteEngineKind;
use App\Enums\SkipReason;
use Illuminate\Validation\ValidationException;

/**
 * NU §2.1 steps 3–10 in rules mode: split, classify, extract, match, validate, status and name.
 *
 * @phpstan-import-type TaskRow from CommandMatcher
 */
final class NoteEngine
{
    private const ITEM_REF_PREFIX = 'i';

    private const EMPTY_PLAN = ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];

    public function __construct(
        private NoteSplitter $splitter,
        private ItemClassifier $classifier,
        private FieldExtractor $extractor,
        private CommandMatcher $matcher,
        private PlanValidator $validator,
        private NoteNamer $namer,
    ) {}

    /** The note item an entry came from, counted from 0: "i3" and "i3-2" are item 2. */
    public static function itemIndex(string $ref): ?int
    {
        return preg_match('~^'.self::ITEM_REF_PREFIX.'(\d+)(?:-\d+)?$~', $ref, $match) === 1 ? (int) $match[1] - 1 : null;
    }

    /**
     * Items left once the rules budget is spent become plain tasks (SEC-23).
     *
     * @param  list<TaskRow>  $openTasks
     * @param  list<TaskRow>  $doneTasks
     */
    public function build(string $text, NoteContext $context, array $openTasks = [], array $doneTasks = [], ?float $budgetMs = null): NoteBuild
    {
        $budgetMs ??= (float) config('notes.engine_budget_ms');
        $started = hrtime(true);
        $plan = self::EMPTY_PLAN;
        $lowConfidence = [];
        foreach ($this->splitter->split($text, array_values($context->projects)) as $index => $item) {
            $ref = self::ITEM_REF_PREFIX.($index + 1);
            $expired = (hrtime(true) - $started) / 1e6 >= $budgetMs;
            $planned = $expired
                ? ($this->extractor->hasUnresolvedReference($item, $context)
                    ? $this->skipped($ref, $item, SkipReason::Unclear, true)
                    : ['plan' => [...self::EMPTY_PLAN, 'create' => [$this->createEntry($ref, $this->extractor->plain($item), null)]], 'low' => true])
                : $this->planItem($ref, $item, $context, $openTasks, $doneTasks);
            if (count($plan['create']) + count($planned['plan']['create']) > (int) config('notes.max_items')) {
                throw ValidationException::withMessages(['text' => ['note.too_many_items']]);
            }
            foreach ($planned['plan'] as $kind => $entries) {
                $plan[$kind] = [...$plan[$kind], ...$entries];
            }
            if ($planned['low']) {
                $lowConfidence = [...$lowConfidence, ...($planned['uncertain'] ?? [$ref => $item])];
            }
        }
        $tasksById = array_column($openTasks, null, 'id');
        $validated = $this->validator->validate($plan, $context->projects, $tasksById);

        return new NoteBuild($validated, $this->validator->status($validated), $this->namer->name($validated, $text, $context, $tasksById), NoteEngineKind::Rules, $lowConfidence);
    }

    /**
     * @param  list<TaskRow>  $openTasks
     * @param  list<TaskRow>  $doneTasks
     * @return array{plan: array<string, list<array<string, mixed>>>, low: bool, uncertain?: array<string, string>}
     */
    private function planItem(string $ref, string $item, NoteContext $context, array $openTasks, array $doneTasks): array
    {
        $classification = $this->classifier->classify($item, $context);

        return match ($classification->kind) {
            ItemKind::Skip => $this->skipped($ref, $item, SkipReason::Skip),
            ItemKind::Command => $this->commands($ref, $item, $this->matcher->matchEach($item, $classification->commandAction(), $openTasks, $doneTasks, $context)),
            ItemKind::Task => $this->task($ref, $item, $context, $openTasks),
        };
    }

    /**
     * One entry per task the command names ("move report and gym to friday"): the first keeps the item's ref, the
     * others add "-2", "-3", so every entry has its own.
     *
     * @param  list<CommandMatch>  $matches
     * @return array{plan: array<string, list<array<string, mixed>>>, low: bool, uncertain: array<string, string>}
     */
    private function commands(string $ref, string $item, array $matches): array
    {
        $plan = self::EMPTY_PLAN;
        $low = false;
        $uncertain = [];
        foreach ($matches as $index => $match) {
            $targetRef = $index === 0 ? $ref : $ref.'-'.($index + 1);
            $source = $match->sourceText ?? $item;
            $planned = $this->command($targetRef, $source, $match);
            if ($planned['low']) {
                $uncertain[$targetRef] = $source;
            }
            foreach ($planned['plan'] as $kind => $entries) {
                $plan[$kind] = [...$plan[$kind], ...$entries];
            }
            $low = $low || $planned['low'];
        }

        return ['plan' => $plan, 'low' => $low, 'uncertain' => $uncertain];
    }

    /** @return array{plan: array<string, list<array<string, mixed>>>, low: bool} */
    private function command(string $ref, string $item, CommandMatch $match): array
    {
        if ($match->skip !== null) {
            // An unmatched command may still mean something to the LLM.
            return $this->skipped($ref, $item, $match->skip, $match->skip === SkipReason::NotFound);
        }
        if ($match->newTask !== null) {
            return ['plan' => [...self::EMPTY_PLAN, 'create' => [$this->createEntry($ref, $match->newTask, null)]], 'low' => $match->newTask->lowConfidence];
        }
        // A change that would leave the task as it is comes back as a no_change skip, never empty.
        $change = $match->change;
        assert($change !== null);
        $entry = ['ref' => $ref, 'task_id' => $change->taskId, 'label' => $change->label, ...$change->fields];
        $tie = $match->isTie() ? [['ref' => $ref, 'candidates' => $match->tiedTaskIds, 'preselected' => $change->taskId]] : [];

        return ['plan' => [...self::EMPTY_PLAN, $change->delete ? 'delete' : 'update' => [$entry], 'ambiguous' => $tie], 'low' => false];
    }

    /**
     * @param  list<TaskRow>  $openTasks
     * @return array{plan: array<string, list<array<string, mixed>>>, low: bool}
     */
    private function task(string $ref, string $item, NoteContext $context, array $openTasks): array
    {
        if ($this->extractor->hasUnresolvedReference($item, $context)) {
            return $this->skipped($ref, $item, SkipReason::Unclear, true);
        }
        $fields = $this->extractor->extract($item, $context);
        if ($fields->title === '') {
            return $this->skipped($ref, $item, SkipReason::Skip);
        }
        $entry = $this->createEntry($ref, $fields, $this->duplicateOf($fields, $openTasks, $context));
        $entries = NoteCopies::expand($entry, $fields->copies);

        return ['plan' => [...self::EMPTY_PLAN, 'create' => $entries], 'low' => $fields->lowConfidence];
    }

    /** @return array{plan: array<string, list<array<string, mixed>>>, low: bool} */
    private function skipped(string $ref, string $item, SkipReason $reason, bool $low = false): array
    {
        return ['plan' => [...self::EMPTY_PLAN, 'skipped' => [['ref' => $ref, 'text' => $item, 'reason' => $reason->value]]], 'low' => $low];
    }

    /**
     * NU-E13: an open task with the same meaningful words and due date; the task is still created.
     *
     * @param  list<TaskRow>  $openTasks
     */
    private function duplicateOf(ExtractedFields $fields, array $openTasks, NoteContext $context): ?string
    {
        $words = $this->matcher->words($fields->title, $context);
        sort($words);
        foreach ($openTasks as $task) {
            $other = $this->matcher->words($task['title'], $context);
            sort($other);
            if ($words !== [] && $words === $other && ($task['due_date'] ?? null) === $fields->dueDate) {
                return $task['id'];
            }
        }

        return null;
    }

    /** @return array<string, mixed> the plan's create entry (NU §7) */
    private function createEntry(string $ref, ExtractedFields $fields, ?string $duplicateOf): array
    {
        return [
            'ref' => $ref, 'title' => $fields->title, 'due_date' => $fields->dueDate,
            'start_time' => $fields->startTime, 'end_time' => $fields->endTime, 'priority' => $fields->priority->value,
            'project_id' => $fields->projectId, 'repeat' => $fields->repeat->value, 'reminder' => $fields->reminder->value,
            'notes' => $fields->notes, 'duplicate_of' => $duplicateOf,
            ...($fields->repeatRule === null ? [] : ['repeat_rule' => $fields->repeatRule]),
        ];
    }
}
