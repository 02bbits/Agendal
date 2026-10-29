<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\CommandAction;
use App\Enums\SkipReason;
use DateTimeImmutable;

/**
 * Finds the open task a command means and plans the change (NU §2.4).
 *
 * @phpstan-type TaskRow array{id: string, title: string, due_date?: ?string, start_time?: ?string, end_time?: ?string, done?: bool, deleted_at?: ?string}
 */
final class CommandMatcher
{
    public function __construct(
        private FieldExtractor $extractor,
        private NoteDateParser $dates,
        private NoteTimeParser $times,
    ) {}

    /**
     * The meaningful words: the title's words without the command verb, dates, times and stop words.
     * No stemming; diacritics stay, so "bài tập" matches "Bài tập SQL" but "bai tap" doesn't.
     *
     * @return list<string>
     */
    public function words(string $text, NoteContext $context): array
    {
        $title = $this->extractor->extract($text, $context)->title;
        $starts = implode('|', array_map(NoteVocabulary::phrases(...), ['complete_command', 'move_command', 'delete_command']));
        $ends = NoteVocabulary::phrases('complete_suffix').'|'.NoteVocabulary::phrases('complete_suffix_bare');
        $title = (string) preg_replace('~^(?:'.$starts.')(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:'.$ends.')[\p{P}\s]*$~iu', ' ', $title);
        $stopWords = array_map(mb_strtolower(...), [...NoteVocabulary::values('stop_word'), ...NoteVocabulary::values('reschedule_target')]);

        return array_values(array_unique(array_diff($this->tokens($title), $stopWords)));
    }

    /**
     * Meaningful words found in the title ÷ meaningful words in the command.
     *
     * @param  list<string>  $words
     */
    public function score(array $words, string $title): float
    {
        return $words === [] ? 0.0 : count(array_intersect($words, $this->tokens($title))) / count($words);
    }

    /**
     * @param  list<TaskRow>  $openTasks  the user's open candidates
     * @param  list<TaskRow>  $doneTasks  the user's done candidates, for NU-E12
     */
    public function match(string $text, CommandAction $action, array $openTasks, array $doneTasks, NoteContext $context): CommandMatch
    {
        $words = $this->words($text, $context);
        $ranked = $this->ranked($words, $openTasks);
        if ($ranked === []) {
            return $this->withoutOpenMatch($text, $action, $words, $doneTasks, $context);
        }
        $topScore = $ranked[0]['score'];
        $tied = array_column(array_filter($ranked, fn (array $row): bool => $row['score'] === $topScore), 'task');
        $tiedIds = count($tied) > 1 ? array_slice(array_column($tied, 'id'), 0, (int) config('notes.tie_choices')) : [];

        return CommandMatch::change($this->change($text, $action, $ranked[0]['task'], $context), $tiedIds);
    }

    /**
     * Open tasks scoring at least the threshold, best first; equal scores put the soonest due date first
     * and tasks without one last (NU-E11).
     *
     * @param  list<string>  $words
     * @param  list<TaskRow>  $tasks
     * @return list<array{task: TaskRow, score: float}>
     */
    private function ranked(array $words, array $tasks): array
    {
        $ranked = [];
        foreach ($tasks as $task) {
            $open = ! ($task['done'] ?? false) && ($task['deleted_at'] ?? null) === null;
            $score = $this->score($words, $task['title']);
            if ($open && $score >= (float) config('notes.match_threshold')) {
                $ranked[] = ['task' => $task, 'score' => $score];
            }
        }
        usort($ranked, fn (array $a, array $b): int => ($b['score'] <=> $a['score'])
            ?: $this->dueOrder($a['task']['due_date'] ?? null, $b['task']['due_date'] ?? null)
            ?: strcmp($a['task']['id'], $b['task']['id']));

        return $ranked;
    }

    private function dueOrder(?string $a, ?string $b): int
    {
        return match (true) {
            $a === $b => 0,
            $a === null => 1,
            $b === null => -1,
            default => strcmp($a, $b),
        };
    }

    /**
     * NU-E12, NU-E29: a done task that matches → already done; a reschedule → a new task with the target
     * date; complete or delete → not found (Q17: never a new task named "Delete …").
     *
     * @param  list<string>  $words
     * @param  list<TaskRow>  $doneTasks
     */
    private function withoutOpenMatch(string $text, CommandAction $action, array $words, array $doneTasks, NoteContext $context): CommandMatch
    {
        foreach ($doneTasks as $task) {
            if ($this->score($words, $task['title']) >= (float) config('notes.match_threshold')) {
                return CommandMatch::skip(SkipReason::AlreadyDone);
            }
        }
        if ($action !== CommandAction::Reschedule) {
            return CommandMatch::skip(SkipReason::NotFound);
        }
        $withoutVerb = (string) preg_replace('~^(?:'.NoteVocabulary::phrases('move_command').')\s+~iu', '', trim($text));
        $fields = $this->extractor->extract($withoutVerb, $context);
        $title = (string) preg_replace('~\s+(?:'.NoteVocabulary::phrases('reschedule_target').')$~iu', '', $fields->title);

        return CommandMatch::newTask($fields->withTitle($title));
    }

    /** @param TaskRow $task */
    private function change(string $text, CommandAction $action, array $task, NoteContext $context): TaskChange
    {
        return match ($action) {
            CommandAction::Complete => new TaskChange($task['id'], __('notes.label.completed'), fields: ['done' => true]),
            CommandAction::Delete => new TaskChange($task['id'], $task['title'], delete: true),
            CommandAction::Reschedule => $this->reschedule($text, $task, $context),
        };
    }

    /**
     * A new date alone keeps the task's times; a new time sets the start and moves the end by the same
     * amount (NU-E35). An end that would pass midnight is dropped (TK-3). A value the task already has is
     * no change ("move dentist to next tue" when it is due that Tuesday).
     *
     * @param  TaskRow  $task
     */
    private function reschedule(string $text, array $task, NoteContext $context): TaskChange
    {
        $fields = [];
        $label = $task['title'];
        $newDate = $this->dates->parse($text, $context, null)->date;
        if ($newDate !== null && $newDate !== ($task['due_date'] ?? null)) {
            $fields['due_date'] = $newDate;
            $label = __('notes.label.due', ['date' => $this->labelDate($newDate), 'was' => $this->was($task['due_date'] ?? null, $context)]);
        }
        $newStart = $this->times->parse($text, $context)->start;
        if ($newStart !== null && $newStart !== ($task['start_time'] ?? null)) {
            $fields['start_time'] = $newStart;
            if (($task['start_time'] ?? null) !== null && ($task['end_time'] ?? null) !== null) {
                $fields['end_time'] = $this->movedEnd($task['start_time'], $task['end_time'], $newStart);
            }
        }

        return new TaskChange($task['id'], $label, fields: $fields);
    }

    private function movedEnd(string $oldStart, string $oldEnd, string $newStart): ?string
    {
        $day = new DateTimeImmutable('today');
        $duration = $day->modify($oldEnd)->getTimestamp() - $day->modify($oldStart)->getTimestamp();
        if ($duration <= 0) {
            return null;
        }
        $end = $day->modify($newStart)->modify('+'.$duration.' seconds');

        return $end->format('Y-m-d') === $day->format('Y-m-d') ? $end->format('H:i') : null;
    }

    private function was(?string $date, NoteContext $context): string
    {
        return match ($date) {
            null => __('notes.label.was_no_date'),
            $context->today()->format('Y-m-d') => __('notes.label.was_today'),
            $context->today()->modify('+1 day')->format('Y-m-d') => __('notes.label.was_tomorrow'),
            default => $this->labelDate($date),
        };
    }

    private function labelDate(string $date): string
    {
        return (new DateTimeImmutable($date))->format(__('notes.label.date_format'));
    }

    /** @return list<string> */
    private function tokens(string $text): array
    {
        return preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), flags: PREG_SPLIT_NO_EMPTY) ?: [];
    }
}
