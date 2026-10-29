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

    /** CSV cells are literal phrases, never executable regex fragments. A space matches any run of whitespace. */
    public static function phrases(string $category): string
    {
        return implode('|', array_map(fn (string $phrase): string => (string) preg_replace('/\s+/', '\s+', preg_quote($phrase, '~')), self::values($category)));
    }

    /**
     * Keyword phrases per project, from "project_keyword:<Project>" categories.
     *
     * @return array<string, string>
     */
    public static function projectKeywords(): array
    {
        self::$rules ??= self::load();
        $keywords = [];
        foreach (array_keys(self::$rules) as $category) {
            if (str_starts_with($category, 'project_keyword:')) {
                $keywords[substr($category, strlen('project_keyword:'))] = self::phrases($category);
            }
        }

        return $keywords;
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
        $file = fopen((string) config('notes.rules'), 'rb');
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
