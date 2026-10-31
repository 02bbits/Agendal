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
    private const MINUTES_PER_DAY = 1440;

    public function __construct(
        private FieldExtractor $extractor,
        private NoteDateParser $dates,
        private NoteTimeParser $times,
        private RescheduleTarget $target,
    ) {}

    /**
     * The meaningful words: the title's words without the command verb, dates, times, stop words and the
     * reschedule target ("to 10am"). No stemming; diacritics stay, so "bài tập" matches "Bài tập SQL" but
     * "bai tap" doesn't.
     *
     * @return list<string>
     */
    public function words(string $text, NoteContext $context): array
    {
        // The verb goes first, so a lead-in after it ("done remind me to call mom") starts the text the extractor reads.
        $starts = implode('|', array_map(NoteVocabulary::phrases(...), ['complete_command', 'move_command', 'delete_command']));
        $subject = (string) preg_replace('~^\s*(?:'.$starts.')(?![\p{L}\p{N}_])[\p{P}\s]*~iu', '', $this->subject($text, $context));
        $title = $this->extractor->extract($subject, $context)->title;
        $ends = NoteVocabulary::phrases('complete_suffix').'|'.NoteVocabulary::phrases('complete_suffix_bare');
        $title = (string) preg_replace('~(?<![\p{L}\p{N}_])(?:'.$ends.')[\p{P}\s]*$~iu', ' ', $title);

        return array_values(array_unique(array_diff($this->tokens($title), $this->stopWords())));
    }

    /**
     * Repeat and priority words of the command ("weekly", "urgent"). The extractor reads them as fields, so they
     * are no meaningful words, yet a title that has them is the closer match: "move weekly report" means
     * "Weekly report" over "Monthly report", and still matches "Report".
     *
     * @return list<string>
     */
    public function modifierWords(string $text, NoteContext $context): array
    {
        $categories = ['priority_high', 'priority_low', 'repeat_prefix', ...array_map(fn (string $key): string => 'repeat:'.$key, array_keys(NoteVocabulary::family('repeat')))];
        $modifiers = $this->tokens(implode(' ', array_merge(...array_map(NoteVocabulary::values(...), $categories))));
        $present = array_intersect($this->tokens($this->subject($text, $context)), $modifiers);

        return array_values(array_unique(array_diff($present, $this->words($text, $context), $this->stopWords())));
    }

    /**
     * Words found in the title ÷ words that count. A modifier word counts only when the title has it.
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     */
    public function score(array $words, string $title, array $modifiers = []): float
    {
        $found = $this->found($words, $title, $modifiers);
        $counted = count($words) + $found - count(array_intersect($words, $this->tokens($title)));

        return $counted === 0 ? 0.0 : $found / $counted;
    }

    /**
     * @param  list<TaskRow>  $openTasks  the user's open candidates
     * @param  list<TaskRow>  $doneTasks  the user's done candidates, for NU-E12
     */
    public function match(string $text, CommandAction $action, array $openTasks, array $doneTasks, NoteContext $context): CommandMatch
    {
        $words = $this->words($text, $context);
        $modifiers = $this->modifierWords($text, $context);
        $ranked = $this->ranked($words, $modifiers, $openTasks);
        if ($ranked === []) {
            return $this->withoutOpenMatch($text, $action, $words, $modifiers, $doneTasks, $context);
        }
        $best = [$ranked[0]['score'], $ranked[0]['found'], $ranked[0]['extra']];
        $tied = array_column(array_filter($ranked, fn (array $row): bool => [$row['score'], $row['found'], $row['extra']] === $best), 'task');
        $tiedIds = count($tied) > 1 ? array_slice(array_column($tied, 'id'), 0, (int) config('notes.tie_choices')) : [];
        // The first tied task the command would change: "move report to friday" means the Report not yet due then.
        foreach ($tied as $task) {
            $change = $this->change($text, $action, $task, $context);
            if ($change !== null) {
                return CommandMatch::change($change, $tiedIds);
            }
        }

        // Every match already has the new date and time: nothing to change, like a task already done.
        return CommandMatch::skip(SkipReason::AlreadyDone);
    }

    /**
     * Open tasks scoring at least the threshold, best first; then more words found, then fewer title words the
     * command doesn't name ("done buy milk" means "Buy milk" over "Buy milk and eggs"), then the soonest due
     * date, with tasks without one last (NU-E11).
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     * @param  list<TaskRow>  $tasks
     * @return list<array{task: TaskRow, score: float, found: int, extra: int}>
     */
    private function ranked(array $words, array $modifiers, array $tasks): array
    {
        $ranked = [];
        foreach ($tasks as $task) {
            $open = ! ($task['done'] ?? false) && ($task['deleted_at'] ?? null) === null;
            $score = $this->score($words, $task['title'], $modifiers);
            if ($open && $score >= (float) config('notes.match_threshold')) {
                $ranked[] = ['task' => $task, 'score' => $score, 'found' => $this->found($words, $task['title'], $modifiers), 'extra' => $this->extra($words, $task['title'], $modifiers)];
            }
        }
        usort($ranked, fn (array $a, array $b): int => ($b['score'] <=> $a['score'])
            ?: ($b['found'] <=> $a['found'])
            ?: ($a['extra'] <=> $b['extra'])
            ?: $this->dueOrder($a['task']['due_date'] ?? null, $b['task']['due_date'] ?? null)
            ?: strcmp($a['task']['id'], $b['task']['id']));

        return $ranked;
    }

    /**
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     */
    private function found(array $words, string $title, array $modifiers): int
    {
        $tokens = $this->tokens($title);

        return count(array_intersect($words, $tokens)) + count(array_intersect($modifiers, $tokens));
    }

    /**
     * Meaningful title words the command doesn't name.
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     */
    private function extra(array $words, string $title, array $modifiers): int
    {
        return count(array_unique(array_diff($this->tokens($title), $words, $modifiers, $this->stopWords())));
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
     * date; a delete with a deadline → that task; otherwise complete or delete → not found (Q17: never a new
     * task named "Delete …").
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     * @param  list<TaskRow>  $doneTasks
     */
    private function withoutOpenMatch(string $text, CommandAction $action, array $words, array $modifiers, array $doneTasks, NoteContext $context): CommandMatch
    {
        foreach ($doneTasks as $task) {
            if ($this->score($words, $task['title'], $modifiers) >= (float) config('notes.match_threshold')) {
                return CommandMatch::skip(SkipReason::AlreadyDone);
            }
        }
        // "cancel netflix before the 10th" or "drop the kids at school" with no such task is a task to do, not a
        // lost command: a deadline or a place belongs to an action in the world, which a delete never needs.
        if ($action === CommandAction::Delete && ($this->hasDeadline($text, $context) || $this->hasPlace($text))) {
            return CommandMatch::newTask($this->extractor->extract($text, $context));
        }
        if ($action !== CommandAction::Reschedule) {
            return CommandMatch::skip(SkipReason::NotFound);
        }
        // The subject names the task; its own dates and times are the old ones, so only the target's count.
        $withoutVerb = (string) preg_replace('~^(?:'.NoteVocabulary::phrases('move_command').')\s+~iu', '', trim($this->subject($text, $context)));
        $fields = $this->extractor->extract($withoutVerb, $context);
        $at = $this->extractor->extract($fields->title.' '.$this->when($text, $context), $context);

        return CommandMatch::newTask($fields->withWhen($at));
    }

    /**
     * Null when the command changes nothing.
     *
     * @param  TaskRow  $task
     */
    private function change(string $text, CommandAction $action, array $task, NoteContext $context): ?TaskChange
    {
        return match ($action) {
            CommandAction::Complete => new TaskChange($task['id'], __('notes.label.completed'), fields: ['done' => true]),
            CommandAction::Delete => new TaskChange($task['id'], $task['title'], delete: true),
            CommandAction::Reschedule => $this->reschedule($text, $task, $context),
        };
    }

    /**
     * A new date alone keeps the task's times (NU-E35); a time for a task with no date falls on today, or
     * tomorrow once that time has passed (NU-E5). A new time sets the start and moves the end by the same
     * amount, unless the target gives its own end ("to 2-3pm"); an end that would pass midnight is dropped
     * (TK-3). Values the task already has are no change, and null means nothing changes.
     *
     * @param  TaskRow  $task
     */
    private function reschedule(string $text, array $task, NoteContext $context): ?TaskChange
    {
        $when = $this->when($text, $context);
        $at = $this->extractor->extract($when, $context);
        [$oldDate, $oldStart, $oldEnd] = [$task['due_date'] ?? null, $task['start_time'] ?? null, $task['end_time'] ?? null];
        $statedDate = $this->dates->parse($when, $context, $at->startTime)->date ?? $this->times->parse($when, $context)->date;
        $newDate = $oldDate === null ? $at->dueDate : $statedDate;
        $fields = [];
        if ($newDate !== null && $newDate !== $oldDate) {
            $fields['due_date'] = $newDate;
        }
        if ($at->startTime !== null) {
            $newEnd = $at->endTime ?? ($oldStart !== null && $oldEnd !== null ? $this->movedEnd($oldStart, $oldEnd, $at->startTime) : $oldEnd);
            if ($at->startTime !== $oldStart) {
                $fields['start_time'] = $at->startTime;
            }
            if ($newEnd !== $oldEnd) {
                $fields['end_time'] = $newEnd;
            }
        }
        if ($fields === []) {
            return null;
        }
        $label = isset($fields['due_date'])
            ? __('notes.label.due', ['date' => $this->labelDate($fields['due_date']), 'was' => $this->was($oldDate, $context)])
            : $task['title'];

        return new TaskChange($task['id'], $label, fields: $fields);
    }

    private function movedEnd(string $oldStart, string $oldEnd, string $newStart): ?string
    {
        $duration = $this->minutes($oldEnd) - $this->minutes($oldStart);
        $end = $this->minutes($newStart) + $duration;
        if ($duration <= 0 || $end >= self::MINUTES_PER_DAY) {
            return null;
        }

        return sprintf('%02d:%02d', intdiv($end, 60), $end % 60);
    }

    /** "09:30" → 570. */
    private function minutes(string $time): int
    {
        [$hour, $minute] = array_map(intval(...), explode(':', $time));

        return $hour * 60 + $minute;
    }

    /** A deadline word ("before", "trước") followed by a date or time. */
    private function hasDeadline(string $text, NoteContext $context): bool
    {
        preg_match_all('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('deadline_prefix').')\s+~iu', $text, $matches, PREG_OFFSET_CAPTURE);
        foreach ($matches[0] as [$word, $offset]) {
            $after = substr($text, $offset + strlen($word));
            if ($this->dates->parse($after, $context, null)->date !== null || $this->times->parse($after, $context)->start !== null) {
                return true;
            }
        }

        return false;
    }

    /** A place word followed by a place, not a time: "at school", "ở nhà", but not "at 3pm" or "at noon". */
    private function hasPlace(string $text): bool
    {
        return preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('place_prefix').')\s+(?!'.NoteVocabulary::modifierPattern().')\p{L}~iu', $text) === 1;
    }

    /** "move 9am standup to 10am" → "move 9am standup"; the whole text when there is no target. */
    private function subject(string $text, NoteContext $context): string
    {
        return $this->target->split($text, $context)['subject'] ?? $text;
    }

    /** "move 9am standup to 10am" → "10am"; empty when there is no target. */
    private function when(string $text, NoteContext $context): string
    {
        return $this->target->split($text, $context)['when'] ?? '';
    }

    /** @return list<string> */
    private function stopWords(): array
    {
        return array_map(mb_strtolower(...), [...NoteVocabulary::values('stop_word'), ...NoteVocabulary::values('reschedule_target')]);
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
