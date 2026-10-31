<?php

declare(strict_types=1);

namespace Tests\Support;

use RuntimeException;

/** Classification scenarios generated from every item-classifier rule in the shared note rules CSV. */
final class NoteClassifierScenarios
{
    /** Categories only the item classifier reads; the splitter generator skips them. */
    public const CLASSIFIER_ONLY_CATEGORIES = ['filler', 'reschedule_target', 'complete_suffix_bare', 'not_command', 'heading_suffix'];

    /** @return array<string, array{0: string, 1: string}> note, expected "kind" or "kind/action" */
    public static function generate(string $rulesPath): array
    {
        $file = fopen($rulesPath, 'rb');
        if ($file === false) {
            throw new RuntimeException('Missing note rules CSV');
        }
        try {
            fgetcsv($file, null, ',', '"', '');
            $cases = [];
            while (($row = fgetcsv($file, null, ',', '"', '')) !== false) {
                if ($row === [null] || count($row) !== 2) {
                    continue;
                }
                [$category, $value] = array_map(trim(...), array_map('strval', $row));
                $examples = self::examples($category, $value);
                if ($examples === [] && in_array($category, self::CLASSIFIER_ONLY_CATEGORIES, true)) {
                    throw new RuntimeException('Add classifier templates for rule category '.$category);
                }
                foreach ($examples as $index => $example) {
                    $cases[$category.' / '.$value.' / '.$index] = $example;
                }
            }

            return $cases;
        } finally {
            fclose($file);
        }
    }

    /** @return list<array{0: string, 1: string}> */
    private static function examples(string $category, string $value): array
    {
        return match ($category) {
            'skip_prefix' => [[$value.' read a book', 'skip']],
            'filler' => [[$value.'!', 'skip'], ['read '.$value.' notes', 'task']],
            'complete_command' => [[$value.' report', 'command/complete']],
            'complete_suffix' => [['report '.$value, 'command/complete']],
            'complete_suffix_bare' => [['report '.$value, 'command/complete'], ['get report '.$value, 'task'], ['get report - '.$value, 'command/complete'], ['get report: '.$value, 'command/complete']],
            'delete_command' => [[$value.' report', 'command/delete']],
            'move_command' => [[$value.' report to friday', 'command/reschedule'], [$value.' report', 'task']],
            'reschedule_target' => [['move report '.$value.' friday', 'command/reschedule'], ['move boxes '.$value.' garage', 'task']],
            'not_command' => [[$value.' the parcel', 'task']],
            'heading_suffix' => [['Shopping list'.$value, 'skip'], ['call mum'.$value, 'task']],
            default => [],
        };
    }
}
