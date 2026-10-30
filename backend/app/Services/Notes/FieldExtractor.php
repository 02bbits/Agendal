<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\Priority;
use App\Enums\Reminder;
use App\Enums\Repeat;
use App\Services\Clock\ReminderCalculator;
use DateTimeImmutable;

/** Reads a task item's fields per NU §2.5; every phrase comes from the shared note rules CSV. */
final class FieldExtractor
{
    /** Unaccented Vietnamese needs at least this many known syllables, so "call me" stays English. */
    private const MIN_VIETNAMESE_SYLLABLES = 2;

    public function __construct(
        private NoteDateParser $dates,
        private NoteTimeParser $times,
        private ReminderCalculator $reminders,
    ) {}

    public function extract(string $text, NoteContext $context): ExtractedFields
    {
        $readable = $this->withoutUnaccentedVietnamese($text);
        $time = $this->times->parse($readable, $context);
        $date = $this->dates->parse($readable, $context, $time->start);
        $repeat = $this->repeat($readable);
        $dueDate = $date->date ?? $time->date ?? $this->impliedDate($time, $repeat['repeat'], $context);
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
        );
    }

    /** The text as a task title with nothing else read, for items left when the rules budget is spent (SEC-23). */
    public function plain(string $text): ExtractedFields
    {
        [$title, $notes] = $this->cut(trim($text));

        return new ExtractedFields($title, $notes, null, null, null, Priority::Low, null, Repeat::Never, Reminder::None, false);
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
     * "every day" → Daily, "every Monday" → Weekly (the date parser sets its first date). Other
     * patterns ("every 2 weeks", "every other day") stay Never and make the item low confidence.
     *
     * @return array{repeat: Repeat, spans: list<array{0: int, 1: int}>, unreadable: bool}
     */
    private function repeat(string $text): array
    {
        $named = NoteVocabulary::findAll('repeat', $text)[0] ?? null;
        if ($named !== null) {
            return ['repeat' => Repeat::from($named['key']), 'spans' => [[$named['offset'], strlen($named['phrase'])]], 'unreadable' => false];
        }
        $unsupported = $this->unsupportedRepeat($text);
        if ($unsupported !== null) {
            return ['repeat' => Repeat::Never, 'spans' => [$unsupported], 'unreadable' => true];
        }
        $weekdays = implode('|', NoteVocabulary::family('weekday'));
        $weekly = preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('repeat_prefix').')\s+(?:'.$weekdays.')(?![\p{L}\p{N}_])~iu', $text) === 1;

        return ['repeat' => $weekly ? Repeat::Weekly : Repeat::Never, 'spans' => [], 'unreadable' => false];
    }

    /**
     * "every 2 weeks", "every other day", "mỗi thứ 3 và thứ 5": one Repeat value can't hold them.
     *
     * @return array{0: int, 1: int}|null the phrase's byte offset and length
     */
    private function unsupportedRepeat(string $text): ?array
    {
        $prefix = NoteVocabulary::phrases('repeat_prefix');
        $weekday = implode('|', NoteVocabulary::family('weekday'));
        $joiner = NoteVocabulary::phrases('list_joiner').'|'.NoteVocabulary::phrases('comma');
        $patterns = [
            NoteVocabulary::pattern(NoteVocabulary::phrases('repeat_unsupported')),
            '~(?<![\p{L}\p{N}_])(?:'.$prefix.')\s+\d+\s*\p{L}*~iu',
            '~(?<![\p{L}\p{N}_])(?:'.$prefix.')\s+(?:'.$weekday.')(?:\s*(?:'.$joiner.')\s*(?:'.$weekday.'))+(?![\p{L}\p{N}_])~iu',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $match, PREG_OFFSET_CAPTURE) === 1) {
                return [$match[0][1], strlen($match[0][0])];
            }
        }

        return null;
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

    /** A project name wins over a keyword (NU-E22); keywords count only for the user's projects (NU-E34). */
    private function project(string $text, NoteContext $context): ?string
    {
        $byPosition = [];
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
        foreach ($spans as [$offset, $length]) {
            $title = substr_replace($title, str_repeat(' ', $length), $offset, $length);
        }
        $pureWords = NoteVocabulary::phrases('priority_high').'|'.NoteVocabulary::phrases('priority_low');
        $title = (string) preg_replace(NoteVocabulary::pattern($pureWords), ' ', $title);
        $title = $this->tidy((string) preg_replace('/\s+/u', ' ', $title));
        $title = (string) preg_replace('~^(?:(?:'.NoteVocabulary::phrases('lead_in').')(?:\s+|$))+~iu', '', $title);
        $title = $this->withKnownCasing($this->tidy($title), $context);
        $title = mb_strtoupper(mb_substr($title, 0, 1)).mb_substr($title, 1);

        return $this->cut($title);
    }

    /** Spaces, dashes, colons, commas, semicolons and full stops left at either end. */
    private function tidy(string $title): string
    {
        $edge = '(?:\s|\p{Pd}|:|'.NoteVocabulary::phrases('comma').'|'.NoteVocabulary::phrases('separator').'|'.NoteVocabulary::phrases('full_stop').')+';

        return (string) preg_replace('~^'.$edge.'|'.$edge.'$~u', '', $title);
    }

    /** Project names keep their own casing (NU-E21); acronyms are written as in the rules. */
    private function withKnownCasing(string $title, NoteContext $context): string
    {
        foreach ([...array_values($context->projects), ...NoteVocabulary::values('acronym')] as $word) {
            $title = (string) preg_replace_callback(NoteVocabulary::pattern(preg_quote($word, '~')), fn (): string => $word, $title);
        }

        return $title;
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
