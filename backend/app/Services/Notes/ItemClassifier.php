<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\CommandAction;

/** Skip, command or task, first match wins (NU §2.3); every phrase comes from the shared note rules CSV. */
final class ItemClassifier
{
    /** Date groups one line may hold ("WED, NOV 25" reads as a weekday, then a month day). */
    private const DATE_GROUPS = 3;

    public function __construct(private RescheduleTarget $target, private NoteDateParser $dates) {}

    public function classify(string $text, NoteContext $context): ItemClassification
    {
        $text = trim($text);
        if ($this->isNotATask($text) || $this->onlyDates($text, $context)) {
            return ItemClassification::skip();
        }
        $action = $this->commandAction($text, $context);

        return $action === null ? ItemClassification::task() : ItemClassification::command($action);
    }

    /**
     * An idea or FYI ("idea: …"), filler ("ok thanks"), a heading ("Tuần này:"), or only date, time and
     * priority words ("tomorrow 9am", NU-E32). "Remember to" is a lead-in and still makes a task.
     */
    private function isNotATask(string $text): bool
    {
        return NoteVocabulary::startsWith($text, 'skip_prefix')
            || $this->onlyFiller($text)
            || $this->isHeading($text)
            || NoteVocabulary::onlyModifiers($text);
    }

    /**
     * A line that is only dates ("WED, NOV 25", the date line of a pasted meeting note) is context, not a task.
     * Each pass blanks the dates read so far, so a weekday and a month day on one line both go.
     */
    private function onlyDates(string $text, NoteContext $context): bool
    {
        $rest = $text;
        for ($pass = 0; $pass < self::DATE_GROUPS; $pass++) {
            $parsed = $this->dates->parse($rest, $context, null);
            if ($parsed->date === null || $parsed->spans === []) {
                return false;
            }
            foreach ($parsed->spans as [$offset, $length]) {
                $rest = substr_replace($rest, str_repeat(' ', $length), $offset, $length);
            }
            if (NoteVocabulary::onlyModifiers($rest)) {
                return true;
            }
        }

        return false;
    }

    /** "ok thanks", "cảm ơn!", or symbols alone ("👍"). */
    private function onlyFiller(string $text): bool
    {
        $words = trim((string) preg_replace('/[\p{P}\p{S}]+/u', ' ', $text));

        return $words === '' || preg_match('~^(?:(?:'.NoteVocabulary::phrases('filler').')\s*)+$~iu', $words) === 1;
    }

    private function isHeading(string $text): bool
    {
        return preg_match('~(?:'.NoteVocabulary::phrases('heading_suffix').')$~u', $text) === 1
            && ! NoteVocabulary::startsWithVerb(NoteVocabulary::withoutLeadIn($text));
    }

    private function commandAction(string $text, NoteContext $context): ?CommandAction
    {
        if (NoteVocabulary::startsWith($text, 'not_command')) {
            return null;
        }

        return match (true) {
            $this->isComplete($text) => CommandAction::Complete,
            NoteVocabulary::startsWith($text, 'delete_command') => CommandAction::Delete,
            // Reschedule needs a move verb and "to / sang / qua / đến <when>"; "move the boxes to the garage" stays a task.
            $this->target->split($text, $context) !== null || $this->target->shift($text) !== null => CommandAction::Reschedule,
            default => null,
        };
    }

    /**
     * "done X", "X is done", "X xong rồi"; a bare "done"/"xong" ending only after a non-verb ("homework done",
     * not "get it done") or set off by a dash, colon or comma ("pick up laundry - done", "gọi mẹ: xong"). A hyphen
     * inside a word ("well-done") sets nothing off.
     */
    private function isComplete(string $text): bool
    {
        $sentenceEnd = '[\p{P}\s]*$';
        $bare = '(?:'.NoteVocabulary::phrases('complete_suffix_bare').')'.$sentenceEnd;
        $notInWord = '(?<![\p{L}\p{N}_])(?<![\p{L}\p{N}]\p{Pd})';

        return NoteVocabulary::startsWith($text, 'complete_command')
            || preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('complete_suffix').')'.$sentenceEnd.'~iu', $text) === 1
            || preg_match('~\S(?:\s*(?::|'.NoteVocabulary::phrases('comma').')|\s+\p{Pd}|\p{Pd}(?=\s))\s*'.$bare.'~iu', $text) === 1
            || (preg_match('~'.$notInWord.$bare.'~iu', $text) === 1 && ! NoteVocabulary::startsWithVerb(NoteVocabulary::withoutLeadIn($text)));
    }
}
