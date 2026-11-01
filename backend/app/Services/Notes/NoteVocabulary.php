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
        return self::alternation(self::values($category));
    }

    /** @param list<string> $values */
    private static function alternation(array $values): string
    {
        usort($values, fn (string $a, string $b): int => mb_strlen($b) <=> mb_strlen($a));

        return implode('|', array_map(fn (string $phrase): string => str_replace("'", "['’]", (string) preg_replace('/\s+/', '\s+', preg_quote($phrase, '~'))), $values));
    }

    /** Date, time, priority and repeat words: they describe a task rather than name one (NU §2.2). */
    public const MODIFIER_CATEGORIES = ['signal', 'week_next', 'week_end', 'weekend', 'month_end', 'repeat_unsupported', 'priority_high', 'priority_low'];

    public const MODIFIER_FAMILIES = ['date_offset', 'weekday', 'month', 'repeat', 'time_word'];

    /** One alternation across all these categories, so "every day" wins over "every" wherever each is listed. */
    public static function modifiers(): string
    {
        return self::alternation(self::modifierValues());
    }

    /**
     * A date, time, priority or repeat word, possibly after a day number (26 Oct), a date or clock time (26/10,
     * 9:30), a number with a time unit (9am, 9h30, 3 days), or an hour after "at" (at 14). No delimiters.
     */
    public static function modifierPattern(): string
    {
        return '(?<![\p{L}\p{N}_])(?:\d{1,2}\s+)?(?:'.self::modifiers().')(?![\p{L}\p{N}_])'
            .'|\d+(?:(?:'.self::phrases('time_separator').')\d+)+'
            .'|\d+\s*(?:'.self::phrases('time_unit').')(?![\p{L}_])'
            .'|(?<![\p{L}\p{N}_])(?:'.self::phrases('time_prefix').')\s+\d{1,2}(?!\d)';
    }

    /** "tomorrow 9am", "không gấp": nothing but date, time, priority and repeat words. */
    public static function onlyModifiers(string $text): bool
    {
        $rest = (string) preg_replace('~'.self::modifierPattern().'~iu', ' ', self::withoutLeadIn($text));

        return preg_match('/[\p{L}\p{N}\p{So}]/u', $rest) !== 1;
    }

    /** The text after any lead-ins ("please", "nhớ"), list joiners ("and") and leading fillers ("thì"). */
    public static function withoutLeadIn(string $text): string
    {
        $leads = self::phrases('lead_in').'|'.self::phrases('list_joiner').'|'.self::phrases('leading_filler');

        return (string) preg_replace('~^(?:(?:'.$leads.')\s+)+~iu', '', $text);
    }

    /** Modifiers plus words that name a task ("quiz", "deadline"). */
    public static function signals(): string
    {
        return self::alternation([...self::modifierValues(), ...self::values('priority_high_content')]);
    }

    /** @return list<string> */
    private static function modifierValues(): array
    {
        self::$rules ??= self::load();
        $values = [];
        foreach (self::$rules as $category => $phrases) {
            $family = explode(':', $category)[0];
            if (in_array($category, self::MODIFIER_CATEGORIES, true) || (str_contains($category, ':') && in_array($family, self::MODIFIER_FAMILIES, true))) {
                $values = [...$values, ...$phrases];
            }
        }

        return $values;
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
