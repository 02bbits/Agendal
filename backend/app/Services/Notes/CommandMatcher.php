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
    private const DAYS_PER_WEEK = 7;

    /** @var list<string>|null */
    private ?array $stopWords = null;

    /** @var array<string, mixed> what each command text read as, by reading and context; see once() */
    private array $read = [];

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
        return $this->once('words', $text, $context, fn (): array => $this->readWords($text, $context));
    }

    /** @return list<string> */
    private function readWords(string $text, NoteContext $context): array
    {
        // The verb goes first, so a lead-in after it ("done remind me to call mom") starts the text the extractor reads.
        $title = $this->extractor->extract($this->withoutVerb($this->subject($text, $context)), $context)->title;
        $ends = NoteVocabulary::phrases('complete_suffix').'|'.NoteVocabulary::phrases('complete_suffix_bare');
        $title = (string) preg_replace('~(?<![\p{L}\p{N}_])(?:'.$ends.')[\p{P}\s]*$~iu', ' ', $title);

        return array_values(array_unique(array_diff(NoteVocabulary::tokens($title), $this->stopWords())));
    }

    /**
     * The words the extractor read as fields in the task's name: repeat, priority, date and time ("weekly",
     * "urgent", "sun" in "sun lotion", "wed" in "wed planning"). They are no meaningful words, yet a title that has
     * them is the closer match: "move weekly report" means "Weekly report" over "Monthly report", "done sun lotion"
     * means "Sun lotion" over "Lotion samples", and both still match without the word.
     *
     * @return list<string>
     */
    private function modifierWords(string $text, NoteContext $context): array
    {
        return $this->once('modifiers', $text, $context, fn (): array => $this->readModifierWords($text, $context));
    }

    /** @return list<string> */
    private function readModifierWords(string $text, NoteContext $context): array
    {
        $ends = NoteVocabulary::phrases('complete_suffix').'|'.NoteVocabulary::phrases('complete_suffix_bare');
        $name = (string) preg_replace('~(?<![\p{L}\p{N}_])(?:'.$ends.')[\p{P}\s]*$~iu', ' ', $this->withoutVerb($this->subject($text, $context)));

        return array_values(array_unique(array_diff(NoteVocabulary::tokens($name), $this->words($text, $context), $this->stopWords())));
    }

    /**
     * Meaningful words found in the title ÷ meaningful words in the command (NU §2.4). Modifier words never change
     * it; they only rank titles that already match (closeness()['found']).
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     */
    public function score(array $words, string $title, array $modifiers = []): float
    {
        return $this->closeness($words, $modifiers, NoteVocabulary::tokens($title))['score'];
    }

    /**
     * How close a title is, from one read of it: the score against the threshold (meaningful words only), the words
     * found with the modifiers the title also has (to rank equal scores: "Weekly report" over "Monthly report"),
     * and title words the command doesn't name.
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     * @param  list<string>  $tokens  the title's words
     * @return array{score: float, found: int, extra: int}
     */
    private function closeness(array $words, array $modifiers, array $tokens): array
    {
        $named = count(array_intersect($words, $tokens));

        return [
            'score' => $words === [] ? 0.0 : $named / count($words),
            'found' => $named + count(array_intersect($modifiers, $tokens)),
            'extra' => count(array_unique(array_diff($tokens, $words, $modifiers, $this->stopWords()))),
        ];
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
        $changes = array_filter(array_map(fn (array $task): ?TaskChange => $this->change($text, $action, $task, $context), $tied));
        $changing = array_keys($changes);
        if ($changing === []) {
            // Every match already has the new date and time: the task stays open with nothing to change.
            return CommandMatch::skip(SkipReason::NoChange);
        }
        // A tie always asks (NU-E11). The choices are the tasks the command would change first, so the preselected
        // one ("move report to friday" means the Report not yet due then) is always listed, soonest due first.
        $listed = array_slice(array_values(array_unique([...$changing, ...array_keys($tied)])), 0, (int) config('notes.tie_choices'));
        sort($listed);
        $tiedIds = count($tied) > 1 ? array_map(fn (int $index): string => $tied[$index]['id'], $listed) : [];

        return CommandMatch::change($changes[$changing[0]], $tiedIds);
    }

    /**
     * Each task a command names: "move report and gym to friday" moves both, "move report to friday and gym to
     * monday" moves each to its own when. A title that has the joiner itself ("Buy milk and eggs") keeps the
     * command whole, and two names that find the same task change it once.
     *
     * @param  list<TaskRow>  $openTasks
     * @param  list<TaskRow>  $doneTasks
     * @return list<CommandMatch>
     */
    public function matchEach(string $text, CommandAction $action, array $openTasks, array $doneTasks, NoteContext $context): array
    {
        [$pieces, $command, $ownWhen] = $this->clauses($text, $context);
        $matches = [];
        for ($first = 0; $first < count($pieces); $first = $last + 2) {
            // The longest run of names one joined title holds whole ("buy milk and eggs" of "Buy milk and eggs"). A
            // run ends at the first name with its own when: "… eggs to friday and May by 2 days" leaves May apart.
            $end = $first;
            while ($end < count($pieces) - 1 && ! $ownWhen($pieces[$end])) {
                $end += 2;
            }
            for ($last = $end; $last > $first; $last -= 2) {
                if ($this->namesJoinedTitle($command(implode('', array_slice($pieces, $first, $last - $first + 1))), $openTasks, $context)) {
                    break;
                }
            }
            $match = $this->match($command(implode('', array_slice($pieces, $first, $last - $first + 1))), $action, $openTasks, $doneTasks, $context);
            $matches[$match->change->taskId ?? 'item '.count($matches)] = $match;
        }

        return array_values($matches);
    }

    /**
     * The meaningful words of the whole command and of each task it names, to fetch candidates for every one
     * ("move report and gym to friday" needs Gym among the candidates even when many tasks say Report).
     *
     * @return list<list<string>>
     */
    public function candidateWords(string $text, NoteContext $context): array
    {
        [$pieces, $command] = $this->clauses($text, $context);
        $names = array_filter($pieces, fn (int $index): bool => $index % 2 === 0, ARRAY_FILTER_USE_KEY);

        return array_values(array_unique(array_filter([$this->words($text, $context), ...array_map(fn (string $name): array => $this->words($command($name), $context), $names)]), SORT_REGULAR));
    }

    /**
     * The names after the verb, with the joiners between them at the odd indexes, and the command each name (or run
     * of names) makes: a name with its own when ("report to friday", "gym by 2 days") keeps it; the others take the
     * when of the last name that has one. A piece of only date, time or priority words ("to friday, 9am") stays
     * with the name before it.
     *
     * @return array{0: list<string>, 1: callable(string): string, 2: callable(string): bool} pieces, command, has its own when
     */
    private function clauses(string $text, NoteContext $context): array
    {
        $body = $this->withoutVerb($text);
        $verb = substr($text, 0, strlen($text) - strlen($body));
        $pieces = [];
        foreach (preg_split(self::joiner(), $body, flags: PREG_SPLIT_DELIM_CAPTURE) ?: [$body] as $index => $piece) {
            // Only what the extractor reads leaves no title: "9am" joins the name before it, "May" stays a name.
            if ($index % 2 === 0 && $pieces !== [] && $this->extractor->extract($piece, $context)->title === '') {
                $joiner = (string) array_pop($pieces);
                $pieces[count($pieces) - 1] .= $joiner.$piece;

                continue;
            }
            $pieces[] = $piece;
        }
        $ownWhen = fn (string $name): bool => $this->target->split($verb.$name, $context) !== null || $this->target->shift($verb.$name) !== null;
        $tail = '';
        foreach (array_reverse($pieces, true) as $index => $piece) {
            if ($index % 2 === 0 && $ownWhen($piece)) {
                $tail = substr($verb.$piece, strlen($this->subject($verb.$piece, $context)));

                break;
            }
        }

        return [array_values($pieces), fn (string $name): string => $ownWhen($name) ? $verb.$name : $verb.$name.$tail, $ownWhen];
    }

    private static function joiner(): string
    {
        return '~(\s*(?:'.NoteVocabulary::phrases('comma').')\s*|\s+(?:'.NoteVocabulary::phrases('command_joiner').')\s+)~iu';
    }

    /**
     * The best open task for the command, changed or not, has a joiner in its title and holds all the command's
     * words: "Report and gym", already due Friday, is what "move report and gym to friday" names.
     *
     * @param  list<TaskRow>  $openTasks
     */
    private function namesJoinedTitle(string $command, array $openTasks, NoteContext $context): bool
    {
        $words = $this->words($command, $context);
        $title = $this->ranked($words, $this->modifierWords($command, $context), $openTasks)[0]['task']['title'] ?? null;

        return $title !== null && preg_match(self::joiner(), ' '.$title.' ') === 1 && array_diff($words, NoteVocabulary::tokens($title)) === [];
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
            if (($task['done'] ?? false) || ($task['deleted_at'] ?? null) !== null) {
                continue;
            }
            $closeness = $this->closeness($words, $modifiers, NoteVocabulary::tokens($task['title']));
            if ($closeness['score'] >= (float) config('notes.match_threshold')) {
                $ranked[] = ['task' => $task, ...$closeness];
            }
        }
        usort($ranked, fn (array $a, array $b): int => ($b['score'] <=> $a['score'])
            ?: ($b['found'] <=> $a['found'])
            ?: ($a['extra'] <=> $b['extra'])
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
     * date; a complete or delete → not found (Q17: never a new task named "Delete …").
     *
     * @param  list<string>  $words
     * @param  list<string>  $modifiers
     * @param  list<TaskRow>  $doneTasks
     */
    private function withoutOpenMatch(string $text, CommandAction $action, array $words, array $modifiers, array $doneTasks, NoteContext $context): CommandMatch
    {
        // A command that names no task ("move to friday", "done") is an item with no title words: skipped (NU-E32).
        if ($words === []) {
            return CommandMatch::skip(SkipReason::Skip);
        }
        foreach ($doneTasks as $task) {
            if ($this->score($words, $task['title'], $modifiers) >= (float) config('notes.match_threshold')) {
                return CommandMatch::skip(SkipReason::AlreadyDone);
            }
        }
        // A move by an amount ("lùi standup 30 phút") has no date to give a new task.
        if ($action !== CommandAction::Reschedule || $this->shift($text, $context) !== null) {
            return CommandMatch::skip(SkipReason::NotFound);
        }
        // The subject names the task; the target's date wins, and its time too when it gives one (NU-E35).
        $subject = $this->withoutVerb($this->subject($text, $context));
        $at = $this->extractor->extract($this->extractor->extract($subject, $context)->title.' '.$this->when($text, $context), $context);

        return CommandMatch::newTask($this->extractor->withWhen($subject, $at, $context));
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
        $shift = $this->shift($text, $context);
        $fields = $this->withValidEnd($shift === null ? $this->toWhen($text, $task, $context) : $this->byAmount($shift, $task, $context), $task);
        if ($fields === []) {
            return null;
        }
        // The new date and time, and the old ones as "was" (T-NU-21): "Due Fri 30 Oct 09:00", was "Fri 23 Oct 09:00".
        $old = [$task['due_date'] ?? null, $task['start_time'] ?? null];
        $new = $context->scheduled($fields['due_date'] ?? $old[0], array_key_exists('start_time', $fields) ? $fields['start_time'] : $old[1]);

        return new TaskChange($task['id'], __('notes.label.due', ['when' => $new]), fields: $fields, was: $context->scheduled(...$old) ?: null);
    }

    /**
     * "move X to <when>": the fields that change.
     *
     * @param  TaskRow  $task
     * @return array{due_date?: string, start_time?: string, end_time?: ?string}
     */
    private function toWhen(string $text, array $task, NoteContext $context): array
    {
        $when = $this->when($text, $context);
        $at = $this->extractor->extract($when, $context);
        [$oldDate, $oldStart, $oldEnd] = [$task['due_date'] ?? null, $task['start_time'] ?? null, $task['end_time'] ?? null];
        $parsed = $this->dates->parse($when, $context, $at->startTime);
        $statedDate = $this->inTaskWeek($when, $parsed, $oldDate, $context) ?? $parsed->date ?? $this->times->parse($when, $context)->date;
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

        return $fields;
    }

    /**
     * "lùi standup 30 phút", "push dentist by a week": the amount is added to the task's own date and time, and
     * the end moves with the start (NU-E35). Minutes and hours need a task time; a task without a date counts
     * from today.
     *
     * @param  array{subject: string, unit: string, amount: int}  $shift
     * @param  TaskRow  $task
     * @return array{due_date?: string, start_time?: string, end_time?: ?string}
     */
    private function byAmount(array $shift, array $task, NoteContext $context): array
    {
        [$oldDate, $oldStart, $oldEnd] = [$task['due_date'] ?? null, $task['start_time'] ?? null, $task['end_time'] ?? null];
        $date = $oldDate ?? $context->today()->format('Y-m-d');
        if (! NoteDurations::isClock($shift['unit'])) {
            $new = ['due_date' => NoteDurations::add(new DateTimeImmutable($date), $shift['amount'], $shift['unit'])->format('Y-m-d')];
        } elseif ($oldStart === null) {
            return [];
        } else {
            $at = NoteDurations::add(new DateTimeImmutable($date.' '.$oldStart), $shift['amount'], $shift['unit']);
            $new = ['due_date' => $at->format('Y-m-d'), 'start_time' => $at->format('H:i')];
            if ($oldEnd !== null) {
                $new['end_time'] = $this->movedEnd($oldStart, $oldEnd, $new['start_time']);
            }
        }
        $old = ['due_date' => $oldDate, 'start_time' => $oldStart, 'end_time' => $oldEnd];

        return array_filter($new, fn (?string $value, string $key): bool => $value !== $old[$key], ARRAY_FILTER_USE_BOTH);
    }

    /**
     * A bare weekday ("dời họp sang thứ 3") means that day in the week of the task's own date, so a task on Thu 29
     * moves back to Tue 27 and one on Mon 26 moves on to Wed 28. Null when the target has more ("thứ 3 tuần sau",
     * "next tuesday"), the task has no future date, or that day is not after today: those follow NU-E2 from today.
     */
    private function inTaskWeek(string $when, ParsedDate $parsed, ?string $oldDate, NoteContext $context): ?string
    {
        $today = $context->today()->format('Y-m-d');
        if ($oldDate === null || $parsed->date === null || count($parsed->spans) !== 1 || $oldDate <= $today) {
            return null;
        }
        [$offset, $length] = $parsed->spans[0];
        $rest = substr_replace($when, str_repeat(' ', $length), $offset, $length);
        foreach ($this->times->parse($when, $context)->spans as [$timeOffset, $timeLength]) {
            $rest = substr_replace($rest, str_repeat(' ', $timeLength), $timeOffset, $timeLength);
        }
        $weekday = '~^(?:'.implode('|', NoteVocabulary::family('weekday')).')$~iu';
        if (preg_replace('~[\s\p{P}]+~u', '', $rest) !== '' || preg_match($weekday, trim(substr($when, $offset, $length))) !== 1) {
            return null;
        }
        $first = $context->weekStart->firstDay();
        $old = new DateTimeImmutable($oldDate);
        $target = (int) (new DateTimeImmutable($parsed->date))->format('w');
        $week = fn (int $day): int => ($day - $first + self::DAYS_PER_WEEK) % self::DAYS_PER_WEEK;
        $date = $old->modify('-'.$week((int) $old->format('w')).' days')->modify('+'.$week($target).' days')->format('Y-m-d');

        return $date <= $today ? null : $date;
    }

    private function movedEnd(string $oldStart, string $oldEnd, string $newStart): ?string
    {
        $duration = NoteDurations::clockMinutes($oldEnd) - NoteDurations::clockMinutes($oldStart);

        return $duration <= 0 ? null : NoteDurations::clockTime(NoteDurations::clockMinutes($newStart) + $duration);
    }

    /**
     * An end not after the start is dropped (TK-3, NU-E30), whichever way the start moved: a task with only an end
     * at 10:00 moved to 5pm keeps no end, as the database requires.
     *
     * @param  array{due_date?: string, start_time?: string, end_time?: ?string}  $fields
     * @param  TaskRow  $task
     * @return array{due_date?: string, start_time?: string, end_time?: ?string}
     */
    private function withValidEnd(array $fields, array $task): array
    {
        $start = array_key_exists('start_time', $fields) ? $fields['start_time'] : ($task['start_time'] ?? null);
        $end = array_key_exists('end_time', $fields) ? $fields['end_time'] : ($task['end_time'] ?? null);
        if ($start !== null && $end !== null && $end <= $start) {
            $fields['end_time'] = null;
        }
        if (array_key_exists('end_time', $fields) && $fields['end_time'] === ($task['end_time'] ?? null)) {
            unset($fields['end_time']);
        }

        return $fields;
    }

    /** "move: dentist to friday" → "dentist to friday"; the command verb and what sets it off. */
    private function withoutVerb(string $text): string
    {
        // A direction right after a move verb ("push back", "dời lên", "lùi lại") belongs to the verb, not the name.
        $direction = NoteVocabulary::phrases('shift_later').'|'.NoteVocabulary::phrases('shift_earlier');
        $move = '(?:'.NoteVocabulary::phrases('move_command').')(?:\s+(?:'.$direction.')(?![\p{L}\p{N}_]))*';
        $verbs = $move.'|'.NoteVocabulary::phrases('complete_command').'|'.NoteVocabulary::phrases('delete_command');

        return (string) preg_replace('~^\s*(?:'.$verbs.')(?![\p{L}\p{N}_])[\p{P}\s]*~iu', '', $text);
    }

    /** "move 9am standup to 10am" → "move 9am standup"; the whole text when there is no target. */
    private function subject(string $text, NoteContext $context): string
    {
        return $this->target->split($text, $context)['subject'] ?? $this->target->shift($text)['subject'] ?? $text;
    }

    /**
     * The amount of a move by an amount; null when the command names a when ("move standup to in 2 hours").
     *
     * @return array{subject: string, unit: string, amount: int}|null
     */
    private function shift(string $text, NoteContext $context): ?array
    {
        return $this->target->split($text, $context) === null ? $this->target->shift($text) : null;
    }

    /** "move 9am standup to 10am" → "10am"; empty when there is no target. */
    private function when(string $text, NoteContext $context): string
    {
        return $this->target->split($text, $context)['when'] ?? '';
    }

    /**
     * A command is read many times while its tasks are ranked and its names grouped; each reading runs once per text
     * and context.
     *
     * @template T
     *
     * @param  callable(): T  $read
     * @return T
     */
    private function once(string $reading, string $text, NoteContext $context, callable $read): mixed
    {
        $key = $reading.'|'.$context->key().'|'.$text;
        if (! array_key_exists($key, $this->read)) {
            $this->read[$key] = $read();
        }

        return $this->read[$key];
    }

    /** @return list<string> */
    private function stopWords(): array
    {
        return $this->stopWords ??= array_map(mb_strtolower(...), [...NoteVocabulary::values('stop_word'), ...NoteVocabulary::values('reschedule_target')]);
    }
}
