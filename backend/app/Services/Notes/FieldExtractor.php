<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\Priority;
use App\Enums\Reminder;
use App\Enums\Repeat;
use App\Services\Clock\ReminderCalculator;
use App\Services\Tasks\RepeatSchedule;
use DateTimeImmutable;
use InvalidArgumentException;

/** Reads a task item's fields per NU §2.5; every phrase comes from the shared note rules CSV. */
final class FieldExtractor
{
    /** Unaccented Vietnamese needs at least this many known syllables, so "call me" stays English. */
    private const MIN_VIETNAMESE_SYLLABLES = 2;

    public function __construct(
        private NoteDateParser $dates,
        private NoteTimeParser $times,
        private ReminderCalculator $reminders,
        private NoteRepeatParser $repeats,
    ) {}

    /** @var array<string, ExtractedFields> fields by context and text: a command reads its name many times */
    private array $extracted = [];

    public function extract(string $text, NoteContext $context): ExtractedFields
    {
        return $this->extracted[$context->key().'|'.$text] ??= $this->read($text, $context);
    }

    private function read(string $text, NoteContext $context): ExtractedFields
    {
        // Literals (URLs, emails, file and project names) hold no field: project "Daily" repeats nothing.
        $readable = $this->withoutUnaccentedVietnamese(NoteVocabulary::withoutLiterals($text, array_values($context->projects)));
        $repeat = $this->repeats->parse($readable, $context);
        // An unsupported recurrence must not become a one-off date from a weekday inside it.
        $time = $repeat['unreadable'] ? new ParsedTime : $this->times->parse($readable, $context);
        if (($repeat['rule'] !== null && $time->unreadable) || ($repeat['copies'] > 1 && $time->start !== null)) {
            // One supplied time does not tell us when the other copies happen. Preserve the whole request.
            $repeat = ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null];
            $time = new ParsedTime;
        }
        $dateText = $readable;
        foreach ($repeat['spans'] as [$offset, $length]) {
            $dateText = substr_replace($dateText, str_repeat(' ', $length), $offset, $length);
        }
        $date = $repeat['unreadable'] ? new ParsedDate(unreadable: true) : $this->dates->parse($dateText, $context, $time->start);
        if (($date->unreadable && $repeat['rule'] !== null)
            || ($time->date !== null && $date->date !== null && $time->date !== $date->date)) {
            $repeat = ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null];
            $time = new ParsedTime;
            $date = new ParsedDate(unreadable: true);
        }
        $dueDate = $repeat['unreadable'] ? null : ($date->date ?? $time->date ?? $this->impliedDate($time, $repeat['repeat'], $context));
        if ($repeat['rule'] !== null) {
            $anchor = $dueDate ?? $context->today()->format('Y-m-d');
            try {
                // The first matching day starts the series; the interval counts from that first occurrence.
                $firstRule = (string) preg_replace('/;INTERVAL=\d+/', ';INTERVAL=1', $repeat['rule']);
                $dueDate = RepeatSchedule::onOrAfter($firstRule, $anchor, $anchor);
            } catch (InvalidArgumentException) {
                $dueDate = null;
            }
            if ($dueDate === null || ($time->date !== null && $dueDate !== $time->date)) {
                $dueDate = null;
                $repeat = ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null];
                $time = new ParsedTime;
                $date = new ParsedDate(unreadable: true);
            }
        }
        [$title, $notes] = $this->title($text, [...$date->spans, ...$time->spans, ...$repeat['spans']], $context);
        $trusted = [];
        if (! $repeat['unreadable']) {
            if (! $date->unreadable && (($date->date !== null && $this->reliableDateSpans($date->spans, $readable)) || $time->date !== null)) {
                $trusted['due_date'] = $dueDate;
            }
            if (! $time->unreadable && $time->start !== null && $this->reliableTime($time, $readable, $text)) {
                $trusted['start_time'] = $time->start;
                if ($time->end !== null) {
                    $trusted['end_time'] = $time->end;
                }
            }
            if ($repeat['spans'] !== [] && $repeat['repeat'] !== Repeat::Never) {
                $trusted['repeat'] = $repeat['repeat']->value;
                $trusted['repeat_rule'] = $repeat['rule'];
            }
            if (($repeat['copies'] ?? 1) > 1) {
                $trusted['copies'] = $repeat['copies'];
            }
        }
        if (NoteVocabulary::contains('priority_high', $readable) || NoteVocabulary::contains('priority_high_content', $readable) || NoteVocabulary::contains('priority_low', $readable)) {
            $trusted['priority'] = $this->priority($readable, $dueDate, $context)->value;
        }
        $project = $this->project($text, $context);
        if ($project !== null) {
            $trusted['project'] = $context->projects[$project];
        }

        return new ExtractedFields(
            title: $title,
            notes: $notes,
            dueDate: $dueDate,
            startTime: $time->start,
            endTime: $time->end,
            priority: $this->priority($readable, $dueDate, $context),
            projectId: $project,
            repeat: $repeat['repeat'],
            reminder: $this->reminder($readable, $dueDate, $time->start, $context),
            lowConfidence: $date->unreadable || $time->unreadable || $repeat['unreadable'] || $this->unactionable($title, $context)
                || $this->unaccentedVietnamese($text) || $this->unknownTask($title, $context),
            repeatRule: $repeat['rule'],
            copies: $repeat['copies'] ?? 1,
            trustedFields: $trusted,
        );
    }

    /**
     * A bare English weekday alias that is also a Vietnamese syllable ("thu") is not reliable evidence in
     * a low-confidence sentence. This does not promote implied dates or unreadable name/date spans.
     *
     * @param  list<array{0: int, 1: int}>  $spans
     */
    private function reliableDateSpans(array $spans, string $text): bool
    {
        $weekdays = implode('|', NoteVocabulary::family('weekday'));
        $syllables = array_map(mb_strtolower(...), NoteVocabulary::values('vietnamese_unaccented_syllable'));
        foreach ($spans as [$offset, $length]) {
            $phrase = mb_strtolower(trim(substr($text, $offset, $length)));
            if (in_array($phrase, $syllables, true) && preg_match('~^(?:'.$weekdays.')$~iu', $phrase) === 1) {
                return false;
            }
        }

        return $spans !== [];
    }

    private function reliableTime(ParsedTime $time, string $readable, string $original): bool
    {
        if (! $this->unaccentedVietnamese($original) || (int) substr((string) $time->start, 0, 2) >= 13) {
            return true;
        }
        // An unaccented day period outside the readable grammar can change a 12-hour clock's meaning.
        // Explicit recognized AM/PM remains reliable; otherwise leave that field for interpretation.
        foreach ($time->spans as [$offset, $length]) {
            $phrase = substr($readable, $offset, $length);
            if (NoteVocabulary::contains('period_am', $phrase) || NoteVocabulary::contains('period_pm', $phrase)) {
                return true;
            }
        }

        return false;
    }

    /** @return array{priority: string, reminder: string} Defaults depend on the final merged schedule. */
    public function scheduleDefaults(string $text, ?string $date, ?string $start, NoteContext $context): array
    {
        $readable = $this->withoutUnaccentedVietnamese(NoteVocabulary::withoutLiterals($text, array_values($context->projects)));

        return ['priority' => $this->priority($readable, $date, $context)->value,
            'reminder' => $this->reminder($readable, $date, $start, $context)->value];
    }

    /** The text as a task title with nothing else read, for items left when the rules budget is spent (SEC-23). */
    public function plain(string $text): ExtractedFields
    {
        [$title, $notes] = $this->cut(trim($text));

        return new ExtractedFields($title, $notes, null, null, null, Priority::Low, null, Repeat::Never, Reminder::None, true);
    }

    /**
     * A reschedule with no matching task becomes a new task (NU-E29): the subject's title, project and repeat, with
     * the date of $at, and its time too when it gives one (NU-E35). Priority and reminder follow the new date and
     * time, unless the subject states a priority ("move urgent call mom to today 10am").
     */
    public function withWhen(string $subject, ExtractedFields $at, NoteContext $context): ExtractedFields
    {
        $fields = $this->extract($subject, $context);
        $readable = $this->withoutUnaccentedVietnamese(NoteVocabulary::withoutLiterals($subject, array_values($context->projects)));
        [$start, $end] = $at->startTime === null ? [$fields->startTime, $fields->endTime] : [$at->startTime, $at->endTime];

        return new ExtractedFields(
            title: $fields->title,
            notes: $fields->notes,
            dueDate: $at->dueDate,
            startTime: $start,
            endTime: $end,
            priority: $this->priority($readable, $at->dueDate, $context),
            projectId: $fields->projectId,
            repeat: $fields->repeat,
            reminder: $this->reminder($readable, $at->dueDate, $start, $context),
            lowConfidence: $fields->lowConfidence || $at->lowConfidence,
            repeatRule: $fields->repeatRule,
            copies: $fields->copies,
            trustedFields: [...$fields->trustedFields, ...array_intersect_key($at->trustedFields, array_flip(['due_date', 'start_time', 'end_time']))],
        );
    }

    /**
     * NU-E40: Vietnamese words that need no accents ("mai", "t2") only count in accented Vietnamese.
     * They are blanked out with spaces so phrase offsets stay the same.
     */
    private function withoutUnaccentedVietnamese(string $text): string
    {
        if ($this->hasAccentedLetters($text)) {
            return $text;
        }

        $unaccented = $this->unaccentedVietnamese($text);
        $blank = fn (array $word): string => str_repeat(' ', strlen($word[0]));
        $text = (string) preg_replace_callback(
            NoteVocabulary::pattern(NoteVocabulary::phrases('vietnamese_ascii_word')),
            $blank,
            $text,
        );
        if ($unaccented) {
            // NU-E40: only blank weekday aliases that are also Vietnamese syllables, not explicit English modifiers.
            $syllables = array_map(mb_strtolower(...), NoteVocabulary::values('vietnamese_unaccented_syllable'));
            $weekdays = implode('|', NoteVocabulary::family('weekday'));
            $text = (string) preg_replace_callback(NoteVocabulary::pattern($weekdays),
                fn (array $word): string => in_array(mb_strtolower($word[0]), $syllables, true) ? $blank($word) : $word[0], $text);
        }

        return $text;
    }

    private function hasAccentedLetters(string $text): bool
    {
        return preg_match('/[^\P{L}\x00-\x7F]/u', $text) === 1;
    }

    /** NU-E5: no date but a time or repeat → today, or tomorrow when that time has passed. */
    private function impliedDate(ParsedTime $time, Repeat $repeat, NoteContext $context): ?string
    {
        if ($time->start === null && $repeat === Repeat::Never) {
            return null;
        }
        $passed = $time->start !== null && $time->start <= $context->clock();

        return $context->today()->modify($passed ? '+1 day' : '+0 days')->format('Y-m-d');
    }

    /** High words win over Low words (NU-E24); otherwise Medium when due today, else Low. */
    private function priority(string $text, ?string $dueDate, NoteContext $context): Priority
    {
        $withoutLow = (string) preg_replace(NoteVocabulary::pattern(NoteVocabulary::phrases('priority_low')), ' ', $text);
        if (NoteVocabulary::contains('priority_high', $withoutLow) || NoteVocabulary::contains('priority_high_content', $withoutLow)) {
            return Priority::High;
        }
        if (NoteVocabulary::contains('priority_low', $text)) {
            return Priority::Low;
        }

        return $dueDate === $context->today()->format('Y-m-d') ? Priority::Medium : Priority::Low;
    }

    /**
     * A project name wins over a keyword (NU-E22); keywords count only for the user's projects (NU-E34). Neither
     * counts inside a URL, email or file name ("sql.example.com", "notes.daily.md").
     */
    private function project(string $text, NoteContext $context): ?string
    {
        $byPosition = [];
        $text = NoteVocabulary::withoutLiterals($text);
        foreach ($context->projects as $id => $name) {
            if (preg_match(NoteVocabulary::pattern(preg_quote($name, '~')), $text, $match, PREG_OFFSET_CAPTURE) === 1) {
                $byPosition[$match[0][1]] ??= (string) $id;
            }
        }
        if ($byPosition !== []) {
            ksort($byPosition);

            return reset($byPosition);
        }
        $idsByName = array_flip(array_map(mb_strtolower(...), $context->projects));
        foreach (NoteVocabulary::projectKeywords() as $name => $keywords) {
            $id = $idsByName[mb_strtolower($name)] ?? null;
            if ($id !== null && preg_match(NoteVocabulary::pattern($keywords), $text) === 1) {
                return (string) $id;
            }
        }

        return null;
    }

    /** Exams and quizzes → 1 day before, any time → 15 minutes before; none when that is already past (NU-E25). */
    private function reminder(string $text, ?string $dueDate, ?string $startTime, NoteContext $context): Reminder
    {
        $reminder = match (true) {
            $dueDate === null => Reminder::None,
            NoteVocabulary::contains('reminder_day_before', $text) => Reminder::OneDay,
            $startTime !== null => Reminder::FifteenMinutes,
            default => Reminder::None,
        };
        if ($reminder === Reminder::None) {
            return $reminder;
        }
        $remindAt = new DateTimeImmutable((string) $this->reminders->compute((string) $dueDate, $startTime, $reminder->value, $context->timezone));

        return $remindAt < $context->now ? Reminder::None : $reminder;
    }

    /**
     * Remove the words read as date, time and repeat, then pure priority words and lead-ins, and tidy the rest
     * (NU §2.5 Title). Read words go by position, so overlapping phrases ("lúc 8 giờ tối" and "tối nay" in
     * "lúc 8 giờ tối nay") leave nothing behind.
     *
     * @param  list<array{0: int, 1: int}>  $spans  byte offset and length in $text
     * @return array{0: string, 1: ?string} title and notes
     */
    private function title(string $text, array $spans, NoteContext $context): array
    {
        $title = $text;
        $lead = '~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('span_lead').')\s+$~iu';
        foreach ($spans as [$offset, $length]) {
            // "gym from monday" → "Gym": the word that leads into a date or time goes with it.
            if (preg_match($lead, substr($text, 0, $offset), $m) === 1) {
                [$offset, $length] = [$offset - strlen($m[0]), $length + strlen($m[0])];
            }
            $title = substr_replace($title, str_repeat(' ', $length), $offset, $length);
        }
        $pureWords = NoteVocabulary::pattern(NoteVocabulary::phrases('priority_high').'|'.NoteVocabulary::phrases('priority_low'));
        $title = NoteVocabulary::outsideLiterals($title, array_values($context->projects), fn (string $part): string => (string) preg_replace($pureWords, ' ', $part));
        $title = $this->tidy((string) preg_replace('/\s+/u', ' ', $title));
        $title = (string) preg_replace('~^(?:(?:'.NoteVocabulary::phrases('lead_in').')(?:\s+|$))+~iu', '', $title);
        $title = $this->withKnownCasing($this->tidy($title), $context);
        // A title that starts with a URL, email or file name keeps it as written.
        $title = (NoteVocabulary::literals($title)[0][0] ?? null) === 0 ? $title : mb_strtoupper(mb_substr($title, 0, 1)).mb_substr($title, 1);

        return $this->cut($title);
    }

    /** Spaces, dashes, colons, commas, semicolons, full stops and joiners ("8am and 8pm" read) left at either end. */
    private function tidy(string $title): string
    {
        $joiner = '(?<![\p{L}\p{N}])(?:'.NoteVocabulary::phrases('list_joiner').')(?![\p{L}\p{N}])';
        $edge = '(?:\s|\p{Pd}|:|'.NoteVocabulary::phrases('comma').'|'.NoteVocabulary::phrases('separator').'|'.NoteVocabulary::phrases('full_stop').')+';

        return (string) preg_replace('~^(?:'.$edge.'|'.$joiner.')+|(?:'.$edge.'|'.$joiner.')+$~iu', '', $title);
    }

    /**
     * Project names keep their own casing (NU-E21); acronyms are written as in the rules, but never inside a URL,
     * email, file or project name ("https://example.com/sql/report.pdf" stays as typed).
     */
    private function withKnownCasing(string $title, NoteContext $context): string
    {
        return NoteVocabulary::outsideLiterals($title, [], function (string $part) use ($context): string {
            foreach ([...array_values($context->projects), ...NoteVocabulary::values('acronym')] as $word) {
                $part = (string) preg_replace_callback(NoteVocabulary::pattern(preg_quote($word, '~')), fn (): string => $word, $part);
            }

            return $part;
        });
    }

    /**
     * NU-E16: a longer title is cut at the last word boundary and the rest starts the notes.
     *
     * @return array{0: string, 1: ?string}
     */
    private function cut(string $title): array
    {
        $limit = (int) config('notes.title_limit');
        if (mb_strlen($title) <= $limit) {
            return [$title, null];
        }
        $boundary = mb_strrpos(mb_substr($title, 0, $limit + 1), ' ') ?: $limit;

        return [trim(mb_substr($title, 0, $boundary)), trim(mb_substr($title, $boundary))];
    }

    /**
     * NU §2.5: no verb and no object left. A title of nothing, or one word that is no task verb, task word,
     * acronym, project or project keyword ("Gym", "Quiz" and "Call" are fine; "Đi chợ" is a whole task).
     */
    private function unactionable(string $title, NoteContext $context): bool
    {
        if ($title === '') {
            return true;
        }
        if (preg_match('~^[\p{L}\p{N}]+$~u', $title) !== 1) {
            return false;
        }
        $known = implode('|', [
            NoteVocabulary::phrases('task_verb'),
            NoteVocabulary::phrases('task_subject'),
            NoteVocabulary::phrases('priority_high_content'),
            NoteVocabulary::phrases('acronym'),
            ...array_values(NoteVocabulary::projectKeywords()),
            ...array_map(fn (string $name): string => preg_quote($name, '~'), array_values($context->projects)),
        ]);

        return preg_match('~^(?:'.$known.')$~iu', $title) !== 1;
    }

    /**
     * NU-E40: Vietnamese typed without accents ("toi can mua sua", "mai hop nhom 9h"). Most of its words are
     * Vietnamese syllables from the rules, at least two of them, and no letter carries an accent.
     */
    private function unaccentedVietnamese(string $text): bool
    {
        if ($this->hasAccentedLetters($text)) {
            return false;
        }
        $words = preg_split('/[^\p{L}]+/u', mb_strtolower($text), flags: PREG_SPLIT_NO_EMPTY) ?: [];
        $syllables = array_map(mb_strtolower(...), NoteVocabulary::values('vietnamese_unaccented_syllable'));
        $vietnamese = count(array_intersect($words, $syllables));

        return $vietnamese >= self::MIN_VIETNAMESE_SYLLABLES && $vietnamese * 2 >= count($words);
    }

    /**
     * A date, time, accent or known word inside an unknown sentence does not establish task intent.
     * After removing supported lead-ins and modifiers, require a supported task phrase at the start.
     */
    private function unknownTask(string $title, NoteContext $context): bool
    {
        if ($this->hasUnresolvedReference($title, $context)
            || NoteVocabulary::contains('uncertain_intent', NoteVocabulary::withoutLiterals($title, array_values($context->projects)))) {
            return true;
        }
        $known = implode('|', [
            NoteVocabulary::phrases('task_verb'),
            NoteVocabulary::phrases('task_subject'),
            NoteVocabulary::phrases('acronym'),
            NoteVocabulary::phrases('priority_high_content'),
            ...array_values(NoteVocabulary::projectKeywords()),
            ...array_map(fn (string $name): string => preg_quote($name, '~'), array_values($context->projects)),
        ]);

        return preg_match('~^(?:'.$known.')(?![\p{L}\p{N}_])~iu', $title) !== 1;
    }

    public function hasUnresolvedReference(string $text, NoteContext $context): bool
    {
        return NoteVocabulary::contains('unresolved_reference', NoteVocabulary::withoutLiterals($text, array_values($context->projects)));
    }
}
