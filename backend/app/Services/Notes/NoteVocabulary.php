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

    /**
     * CSV cells are literal phrases, never executable regex fragments. A space matches any run of whitespace,
     * an apostrophe matches a straight or curly one, and longer phrases are tried first ("rồi thì" before "rồi").
     */
    public static function phrases(string $category): string
    {
        $values = self::values($category);
        usort($values, fn (string $a, string $b): int => mb_strlen($b) <=> mb_strlen($a));

        return implode('|', array_map(fn (string $phrase): string => str_replace("'", "['’]", (string) preg_replace('/\s+/', '\s+', preg_quote($phrase, '~'))), $values));
    }

    /** Categories whose words give a comma fragment a signal of its own (NU §2.2): dates, times, priority, repeat. */
    public const SIGNAL_CATEGORIES = ['signal', 'week_next', 'week_end', 'weekend', 'month_end', 'repeat_unsupported', 'priority_high', 'priority_high_content', 'priority_low'];

    public const SIGNAL_FAMILIES = ['date_offset', 'weekday', 'month', 'repeat', 'time_word'];

    public static function signals(): string
    {
        $phrases = array_map(self::phrases(...), self::SIGNAL_CATEGORIES);
        foreach (self::SIGNAL_FAMILIES as $family) {
            $phrases = [...$phrases, ...array_values(self::family($family))];
        }

        return implode('|', $phrases);
    }

    /**
     * Phrases per key of "<family>:<key>" categories, e.g. family('weekday') => ['1' => 'monday|mon|…', …].
     *
     * @return array<string, string>
     */
    public static function family(string $family): array
    {
        self::$rules ??= self::load();
        $phrases = [];
        foreach (array_keys(self::$rules) as $category) {
            if (str_starts_with($category, $family.':')) {
                $phrases[substr($category, strlen($family) + 1)] = self::phrases($category);
            }
        }

        return $phrases;
    }

    /**
     * Every occurrence of a family's phrases, in text order; a longer phrase wins at the same spot.
     *
     * @return list<array{key: string, phrase: string, offset: int}>
     */
    public static function findAll(string $family, string $text): array
    {
        $found = [];
        foreach (self::family($family) as $key => $phrases) {
            preg_match_all(self::pattern($phrases), $text, $matches, PREG_OFFSET_CAPTURE);
            foreach ($matches[0] as [$phrase, $offset]) {
                $known = $found[$offset] ?? null;
                if ($known === null || strlen($phrase) > strlen($known['phrase'])) {
                    $found[$offset] = ['key' => (string) $key, 'phrase' => $phrase, 'offset' => $offset];
                }
            }
        }
        ksort($found);

        return array_values($found);
    }

    /** @return array<string, string> project name => keyword phrases */
    public static function projectKeywords(): array
    {
        return self::family('project_keyword');
    }

    public static function contains(string $category, string $text): bool
    {
        return preg_match(self::pattern(self::phrases($category)), $text) === 1;
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
