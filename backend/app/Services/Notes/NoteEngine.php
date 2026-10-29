<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\ItemKind;
use App\Enums\NoteEngineKind;
use App\Enums\SkipReason;

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
                ? ['plan' => [...self::EMPTY_PLAN, 'create' => [$this->createEntry($ref, $this->extractor->plain($item), null)]], 'low' => false]
                : $this->planItem($ref, $item, $context, $openTasks, $doneTasks);
            foreach ($planned['plan'] as $kind => $entries) {
                $plan[$kind] = [...$plan[$kind], ...$entries];
            }
            if ($planned['low']) {
                $lowConfidence[$ref] = $item;
            }
        }
        $tasksById = array_column($openTasks, null, 'id');
        $validated = $this->validator->validate($plan, $context->projects, $tasksById);

        return new NoteBuild($validated, $this->validator->status($validated), $this->namer->name($validated, $text, $context, $tasksById), NoteEngineKind::Rules, $lowConfidence);
    }

    /**
     * @param  list<TaskRow>  $openTasks
     * @param  list<TaskRow>  $doneTasks
     * @return array{plan: array<string, list<array<string, mixed>>>, low: bool}
     */
    private function planItem(string $ref, string $item, NoteContext $context, array $openTasks, array $doneTasks): array
    {
        $classification = $this->classifier->classify($item, $context);

        return match ($classification->kind) {
            ItemKind::Skip => $this->skipped($ref, $item, SkipReason::Skip),
            ItemKind::Command => $this->command($ref, $item, $this->matcher->match($item, $classification->commandAction(), $openTasks, $doneTasks, $context)),
            ItemKind::Task => $this->task($ref, $item, $context, $openTasks),
        };
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
        $change = $match->change;
        assert($change !== null);
        if (! $change->delete && $change->fields === []) {
            // "move dentist to next tue" when it is due that Tuesday: the task already is as asked.
            return $this->skipped($ref, $item, SkipReason::AlreadyDone);
        }
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
        $fields = $this->extractor->extract($item, $context);
        if ($fields->title === '') {
            return $this->skipped($ref, $item, SkipReason::Skip);
        }
        $entry = $this->createEntry($ref, $fields, $this->duplicateOf($fields, $openTasks, $context));

        return ['plan' => [...self::EMPTY_PLAN, 'create' => [$entry]], 'low' => $fields->lowConfidence];
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
        ];
    }
}
