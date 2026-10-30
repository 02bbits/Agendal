<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Enums\ItemKind;
use App\Enums\Repeat;
use App\Services\Notes\ExtractedFields;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\ItemClassifier;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteSplitter;
use App\Services\Notes\NoteVocabulary;

/**
 * Properties every note must keep, whatever its wording. Each one stands for a whole class of mistakes, so a
 * new way of writing a date or time is caught without an example for it.
 */
final class NoteInvariants
{
    public function __construct(
        private NoteSplitter $splitter,
        private ItemClassifier $classifier,
        private FieldExtractor $extractor,
    ) {}

    /** @return list<string> what the note breaks, empty when it keeps every property */
    public function violations(string $note, NoteContext $context): array
    {
        $violations = [];
        $items = $this->splitter->split($note, array_values($context->projects));
        foreach ($items as $index => $item) {
            $violations = [...$violations, ...$this->splitViolations($item, $index, count($items))];
            if ($this->classifier->classify($item, $context)->kind === ItemKind::Task) {
                $fields = $this->extractor->extract($item, $context);
                $violations = [...$violations, ...$this->titleViolations($item, $fields, $context), ...$this->confidenceViolations($item, $fields, $context)];
            }
        }

        return array_map(fn (string $violation): string => $violation.' — in '.json_encode($note, JSON_UNESCAPED_UNICODE), $violations);
    }

    /**
     * An item never starts with a year or with list punctuation, and a lone date/time item exists only when the
     * whole note is one (NU-E32).
     *
     * @return list<string>
     */
    private function splitViolations(string $item, int $index, int $count): array
    {
        $violations = [];
        if (preg_match('/^\d{4}(?!\d)/', $item) === 1) {
            $violations[] = 'item starts with a year: '.$item;
        }
        if (preg_match('/^[\p{P}]/u', $item) === 1) {
            $violations[] = 'item starts with punctuation: '.$item;
        }
        if ($count > 1 && $index > 0 && NoteVocabulary::onlyModifiers($item)) {
            $violations[] = 'a date/time fragment was split off: '.$item;
        }

        return $violations;
    }

    /**
     * Reading the title again finds no time and no date that was already read; another date may stay (NU-E6).
     * The title keeps no edge punctuation and no year of the date read.
     *
     * @return list<string>
     */
    private function titleViolations(string $item, ExtractedFields $fields, NoteContext $context): array
    {
        $violations = [];
        $title = $fields->title;
        if ($title === '') {
            return ['empty title for task: '.$item];
        }
        $again = $this->extractor->extract($title, $context);
        if ($fields->startTime !== null && $again->startTime !== null) {
            $violations[] = 'time words left in title "'.$title.'" of: '.$item;
        }
        if ($fields->dueDate !== null && $again->dueDate === $fields->dueDate && $again->startTime === null && $again->repeat === Repeat::Never) {
            $violations[] = 'date words left in title "'.$title.'" of: '.$item;
        }
        if (preg_match('/^[\p{P}\s]|[,;:\-–]$/u', $title) === 1) {
            $violations[] = 'punctuation at title edge "'.$title.'" of: '.$item;
        }
        $joiner = '(?:'.NoteVocabulary::phrases('list_joiner').')';
        if (preg_match('~^'.$joiner.'(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])'.$joiner.'$~iu', $title) === 1) {
            $violations[] = 'joiner left at title edge "'.$title.'" of: '.$item;
        }
        if ($fields->dueDate !== null && preg_match('/(?<!\d)'.substr($fields->dueDate, 0, 4).'(?!\d)/', $title) === 1 && ! $this->inProjectName($title, $context)) {
            $violations[] = 'year left in title "'.$title.'" of: '.$item;
        }

        return $violations;
    }

    private function inProjectName(string $title, NoteContext $context): bool
    {
        foreach ($context->projects as $name) {
            if (stripos($title, $name) !== false && preg_match('/\d{4}/', $name) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * The title of plain English that starts with a known task verb and has a date or time read is understood:
     * low confidence may come from the date or time, never from the title (ADR-008 sends only what the rules
     * can't read).
     *
     * @return list<string>
     */
    private function confidenceViolations(string $item, ExtractedFields $fields, NoteContext $context): array
    {
        $ascii = preg_match('/[^\x00-\x7F]/', $item) !== 1;
        $readSomething = $fields->dueDate !== null || $fields->startTime !== null;
        $englishVerb = $ascii && NoteVocabulary::startsWithVerb(NoteVocabulary::withoutLeadIn(mb_strtolower($item)));

        return $englishVerb && $readSomething && $this->extractor->extract($fields->title, $context)->lowConfidence
            ? ['English task title judged unactionable: '.$fields->title.' of: '.$item] : [];
    }
}
