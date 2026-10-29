<?php

declare(strict_types=1);

namespace App\Services\Notes;

use RuntimeException;

final class NoteVocabulary
{
    /** @var array<string, list<string>>|null */
    private static ?array $rules = null;

    public static function pattern(string $phrases): string
    {
        return '~(?<![\p{L}\p{N}_])(?:'.$phrases.')(?![\p{L}\p{N}_])~iu';
    }

    public static function startsWithVerb(string $text): bool
    {
        return preg_match('~^(?:'.self::phrases('task_verb').')(?![\p{L}\p{N}_])~iu', $text) === 1;
    }

    /** CSV cells are literal phrases, never executable regex fragments. */
    public static function phrases(string $category): string
    {
        return implode('|', array_map(fn (string $phrase): string => preg_quote($phrase, '~'), self::values($category)));
    }

    /** @return list<string> */
    public static function values(string $category): array
    {
        self::$rules ??= self::load();
        if (! isset(self::$rules[$category])) {
            throw new RuntimeException('Missing note vocabulary category: '.$category);
        }

        return self::$rules[$category];
    }

    /** @return array<string, list<string>> */
    private static function load(): array
    {
        $file = fopen(resource_path('notes/splitter-rules.csv'), 'rb');
        if ($file === false) {
            throw new RuntimeException('Cannot open note splitter rules');
        }
        try {
            $header = fgetcsv($file, null, ',', '"', '');
            if (is_array($header)) {
                $header[0] = ltrim((string) $header[0], "\xEF\xBB\xBF");
            }
            if ($header !== ['category', 'value']) {
                throw new RuntimeException('Note rules CSV must have category,value headers');
            }
            $rules = [];
            while (($row = fgetcsv($file, null, ',', '"', '')) !== false) {
                if ($row === [null]) {
                    continue;
                }
                if (count($row) !== 2 || trim((string) $row[0]) === '' || trim((string) $row[1]) === '') {
                    throw new RuntimeException('Invalid note vocabulary row');
                }
                $rules[trim((string) $row[0])][] = trim((string) $row[1]);
            }

            return $rules;
        } finally {
            fclose($file);
        }
    }
}
