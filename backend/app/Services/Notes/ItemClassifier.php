<?php

declare(strict_types=1);

namespace App\Services\Notes;

final class ItemClassifier
{
    /** @return array{type: string, action: ?string} */
    public function classify(string $text): array
    {
        $text = trim($text);
        $filler = trim((string) preg_replace('/[\p{P}\p{S}]/u', '', mb_strtolower($text)));
        if (preg_match('~^(?:'.NoteVocabulary::SKIP_PREFIXES.')(?!\p{L})~iu', $text)
            || preg_match('/^(?:(?:hmm|ok|okay|test|thanks|thank you|cool|lol|ừ|ừm|cảm ơn|thử)\s*)+$/u', $filler)) {
            return ['type' => 'skip', 'action' => null];
        }
        if (preg_match('~^(?:'.NoteVocabulary::COMPLETE.')(?!\p{L})|(?<!\p{L})(?:is done|xong rồi)[.!?]*$~iu', $text)) {
            return ['type' => 'command', 'action' => 'complete'];
        }
        if (preg_match('~^(?:'.NoteVocabulary::DELETE.')(?!\p{L})~iu', $text)) {
            return ['type' => 'command', 'action' => 'delete'];
        }
        if (preg_match('~^(?:'.NoteVocabulary::MOVE.')(?!\p{L})~iu', $text)
            && preg_match(NoteVocabulary::pattern('(?:to|sang|qua|đến)\s+\S.+'), $text)) {
            return ['type' => 'command', 'action' => 'reschedule'];
        }

        return ['type' => 'task', 'action' => null];
    }
}
