<?php

declare(strict_types=1);

namespace App\Services\Notes;

use App\Enums\CommandAction;

/** Skip, command or task, first match wins (NU §2.3); every phrase comes from the shared note rules CSV. */
final class ItemClassifier
{
    public function __construct(
        private NoteDateParser $dates,
        private NoteTimeParser $times,
    ) {}

    public function classify(string $text, NoteContext $context): ItemClassification
    {
        $text = trim($text);
        if ($this->isNotATask($text)) {
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
        return $this->startsWith($text, 'skip_prefix')
            || $this->onlyFiller($text)
            || $this->isHeading($text)
            || NoteVocabulary::onlyModifiers($text);
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
        if ($this->startsWith($text, 'not_command')) {
            return null;
        }

        return match (true) {
            $this->isComplete($text) => CommandAction::Complete,
            $this->startsWith($text, 'delete_command') => CommandAction::Delete,
            $this->startsWith($text, 'move_command') && $this->hasNewDate($text, $context) => CommandAction::Reschedule,
            default => null,
        };
    }

    /** "done X", "X is done", "X xong rồi"; a bare "done"/"xong" ending only after a non-verb ("homework done", not "get it done"). */
    private function isComplete(string $text): bool
    {
        $sentenceEnd = '[\p{P}\s]*$';

        return $this->startsWith($text, 'complete_command')
            || preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('complete_suffix').')'.$sentenceEnd.'~iu', $text) === 1
            || (preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('complete_suffix_bare').')'.$sentenceEnd.'~iu', $text) === 1
                && ! NoteVocabulary::startsWithVerb(NoteVocabulary::withoutLeadIn($text)));
    }

    /** Reschedule needs "to / sang / qua / đến <when>"; "move the boxes to the garage" stays a task. */
    private function hasNewDate(string $text, NoteContext $context): bool
    {
        if (preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('reschedule_target').')\s+(?<when>.+)$~iu', $text, $match) !== 1) {
            return false;
        }

        return $this->dates->parse($match['when'], $context, null)->date !== null
            || $this->times->parse($match['when'], $context)->start !== null;
    }

    private function startsWith(string $text, string $category): bool
    {
        return preg_match('~^(?:'.NoteVocabulary::phrases($category).')(?![\p{L}\p{N}_])~iu', $text) === 1;
    }
}
