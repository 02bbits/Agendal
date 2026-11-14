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

    private const MONTHS_PER_YEAR = 12;

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
        $timeText = $readable;
        foreach ($repeat['boundSpans'] ?? [] as [$offset, $length]) {
            $timeText = substr_replace($timeText, str_repeat(' ', $length), $offset, $length);
        }
        $time = $repeat['unreadable'] ? new ParsedTime : $this->times->parse($timeText, $context);
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
            $bound = $repeat['bound'] ?? null;
            // "next week" runs in that week; "through next week" runs from now to its end.
            $period = isset($bound['period']) ? $this->periodRange($bound['period'], $bound['offset'], $bound['through'], $context) : null;
            $stated = $date->date ?? $time->date;
            // A series in a later period starts on that period's first day.
            $anchor = max($dueDate ?? $context->today()->format('Y-m-d'), $period[0] ?? '');
            try {
                // The first matching day starts the series; the interval counts from that first occurrence.
                $firstRule = (string) preg_replace('/;INTERVAL=\d+/', ';INTERVAL=1', $repeat['rule']);
                $dueDate = RepeatSchedule::onOrAfter($firstRule, $anchor, $anchor);
            } catch (InvalidArgumentException) {
                $dueDate = null;
            }
            if ($dueDate !== null && $bound !== null) {
                [$start, $end] = isset($bound['amount'])
                    ? [$stated ?? $dueDate, $this->boundEnd($dueDate, $bound['amount'], $bound['unit'])]
                    : $this->periodRange($bound['period'], $bound['offset'], $bound['through'], $context);
                // A stated date outside the period, or no occurrence left in it ("every Monday this week" on a Tuesday).
                $outside = $stated !== null && ($stated < $start || $stated > $end);
                $dueDate = $outside || $dueDate > $end ? null : $dueDate;
                $repeat['rule'] .= ';UNTIL='.str_replace('-', '', $end).'T235959Z';
            }
            // #120: words no reader took that still say how long ("for about 3 weeks", "vài tuần") mean part of the
            // schedule was lost, however it was worded; keep the whole item for review instead of an unbounded series.
            $unread = $readable;
            foreach ([...$date->spans, ...$time->spans, ...$repeat['spans']] as [$offset, $length]) {
                $unread = substr_replace($unread, str_repeat(' ', $length), $offset, $length);
            }
            if ($dueDate === null || ($time->date !== null && $dueDate !== $time->date) || NoteRepeatParser::hasDurationShape($unread)) {
                $dueDate = null;
                $repeat = ['repeat' => Repeat::Never, 'spans' => [], 'unreadable' => true, 'rule' => null];
                $time = new ParsedTime;
                $date = new ParsedDate(unreadable: true);
            }
        }
        [$title, $notes] = $this->title($text, [...$date->spans, ...$time->spans, ...$repeat['spans']], $context);

        return new ExtractedFields(
            title: $title,
            notes: $notes,
            dueDate: $dueDate,
            startTime: $time->start,
            endTime: $time->end,
            priority: $this->priority($readable, $dueDate, $context),
            projectId: $this->project($text, $context),
            repeat: $repeat['repeat'],
            reminder: $this->reminder($readable, $dueDate, $time->start, $context),
            lowConfidence: $date->unreadable || $time->unreadable || $repeat['unreadable'] || $this->unactionable($title, $context)
                || $this->unaccentedVietnamese($text) || $this->unknownLanguage($readable, $dueDate !== null || $time->start !== null),
            repeatRule: $repeat['rule'],
            copies: $repeat['copies'] ?? 1,
        );
    }

    /** The text as a task title with nothing else read, for items left when the rules budget is spent (SEC-23). */
    public function plain(string $text): ExtractedFields
    {
        [$title, $notes] = $this->cut(trim($text));

        return new ExtractedFields($title, $notes, null, null, null, Priority::Low, null, Repeat::Never, Reminder::None, false);
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

        return (string) preg_replace_callback(
            NoteVocabulary::pattern(NoteVocabulary::phrases('vietnamese_ascii_word')),
            fn (array $word): string => str_repeat(' ', strlen($word[0])),
            $text,
        );
    }

    private function hasAccentedLetters(string $text): bool
    {
        return preg_match('/[^\P{L}\x00-\x7F]/u', $text) === 1;
    }

    /**
     * The last day of a series that runs for an amount of time from its first date: "every day for 3 days" from
     * 2 Nov runs 2, 3 and 4 Nov. A year is twelve calendar months.
     */
    private function boundEnd(string $first, int $amount, string $unit): string
    {
        return $this->addUnits(new DateTimeImmutable($first), $amount, $unit)->modify('-1 day')->format('Y-m-d');
    }

    /** NoteDurations::add, with a year as twelve calendar months. */
    private function addUnits(DateTimeImmutable $at, int $amount, string $unit): DateTimeImmutable
    {
        return $unit === 'year' ? NoteDurations::add($at, $amount * self::MONTHS_PER_YEAR, 'month') : NoteDurations::add($at, $amount, $unit);
    }

    /**
     * First and last day of this ($offset 0) or the next ($offset 1) week, month or year, or today and that last day
     * when $fromNow; a week starts on the user's week start (AP-5).
     *
     * @return array{0: string, 1: string}
     */
    private function periodRange(string $period, int $offset, bool $fromNow, NoteContext $context): array
    {
        $today = $context->today();
        $start = match ($period) {
            'week' => $today->modify(sprintf('-%d days', ((int) $today->format('w') - $context->weekStart->firstDay() + 7) % 7)),
            'month' => $today->modify('first day of this month'),
            default => $today->setDate((int) $today->format('Y'), 1, 1),
        };
        $first = $this->addUnits($start, $offset, $period)->format('Y-m-d');

        return [$fromNow ? $today->format('Y-m-d') : $first, $this->boundEnd($first, 1, $period)];
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
     * NU-E28: unaccented text where the rules know no word and read no date or time may be another language
     * ("comprar leche"); "team meeting 3pm" is understood through its time.
     */
    private function unknownLanguage(string $text, bool $readDateOrTime): bool
    {
        if ($readDateOrTime || $this->hasAccentedLetters($text)) {
            return false;
        }
        $known = implode('|', [
            NoteVocabulary::phrases('task_verb'),
            NoteVocabulary::phrases('lead_in'),
            NoteVocabulary::phrases('acronym'),
            NoteVocabulary::signals(),
            ...array_values(NoteVocabulary::projectKeywords()),
        ]);

        return preg_match(NoteVocabulary::pattern($known), $text) !== 1;
    }
}
