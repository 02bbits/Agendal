<?php

declare(strict_types=1);

namespace App\Services\Notes;

/**
 * Splits a reschedule into the task it names and the new when: "move 9am standup to 10am" is "move 9am standup"
 * and "10am". The last "to / sang / qua / đến" followed by a date or time splits, so "move talk to bank to friday"
 * keeps "talk to bank" and "move the boxes to the garage" has no target (NU §2.3).
 */
final class RescheduleTarget
{
    public function __construct(
        private NoteDateParser $dates,
        private NoteTimeParser $times,
    ) {}

    /** @return array{subject: string, when: string}|null null for no move command: "done remind me to call mom in 2 hours" has no target */
    public function split(string $text, NoteContext $context): ?array
    {
        if (preg_match('~^\s*(?:'.NoteVocabulary::phrases('move_command').')(?![\p{L}\p{N}_])~iu', $text) !== 1) {
            return null;
        }
        preg_match_all('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('reschedule_target').')\s+~iu', $text, $matches, PREG_OFFSET_CAPTURE);
        foreach (array_reverse($matches[0]) as [$target, $offset]) {
            $when = substr($text, $offset + strlen($target));
            if ($this->dates->parse($when, $context, null)->date !== null || $this->times->parse($when, $context)->start !== null) {
                return ['subject' => rtrim(substr($text, 0, $offset)), 'when' => $when];
            }
        }

        return null;
    }
}
