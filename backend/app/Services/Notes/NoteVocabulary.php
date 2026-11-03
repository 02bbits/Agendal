<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Normalizer;
use RuntimeException;

final class NoteVocabulary
{
    /** @var array<string, list<string>>|null */
    private static ?array $rules = null;

    /** @var array<string, string> Grammar derived from the immutable rules, not from note context. */
    private static array $phrasePatterns = [];

    /** @var array<string, array<string, string>> */
    private static array $families = [];

    private static ?string $modifierExpression = null;

    /**
     * The words of a text, the one way every matcher reads them: composed (NFC), lower-cased, and split on anything
     * but letters and digits, so "_", "-", "." and "/" separate words ("Send_invoice" is "send", "invoice").
     * TaskCandidates::TOKENS reads titles the same way in SQL.
     *
     * @return list<string>
     */
    public static function tokens(string $text): array
    {
        $text = Normalizer::normalize($text, Normalizer::FORM_C) ?: $text;

        return preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), flags: PREG_SPLIT_NO_EMPTY) ?: [];
    }

    /**
     * Text kept as written: URLs, emails, file names ("report.pdf") and the given project names. No date, time,
     * repeat or priority is read inside them, and their casing stays. A project name inside a URL, email or file
     * name ("notes.daily.md") is part of it, not a project.
     *
     * @param  list<string>  $names  project names
     * @return list<array{0: int, 1: int}> byte offset and length, in text order
     */
    public static function literals(string $text, array $names = []): array
    {
        $patterns = [
            '~(?:https?://|www\.)\S+~iu',
            '~[^\s@]+@[^\s@]+~u',
            '~(?<![\p{L}\p{N}_])[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.(?:'.self::phrases('file_extension').')(?![\p{L}\p{N}_])~iu',
        ];
        $spans = [];
        foreach ($patterns as $pattern) {
            preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE);
            foreach ($matches[0] as [$literal, $offset]) {
                $spans[] = [$offset, strlen($literal)];
            }
        }
        if ($names !== []) {
            $outside = self::withoutLiterals($text);
            foreach ($names as $name) {
                preg_match_all(self::pattern(preg_quote($name, '~')), $outside, $matches, PREG_OFFSET_CAPTURE);
                foreach ($matches[0] as [$literal, $offset]) {
                    $spans[] = [$offset, strlen($literal)];
                }
            }
        }
        sort($spans);

        return $spans;
    }

    /**
     * The text with its literals blanked by spaces of the same length, so every offset still points into $text.
     *
     * @param  list<string>  $names  project names
     */
    public static function withoutLiterals(string $text, array $names = []): string
    {
        foreach (self::literals($text, $names) as [$offset, $length]) {
            $text = substr_replace($text, str_repeat(' ', $length), $offset, $length);
        }

        return $text;
    }

    /**
     * $change applied to the text between literals only: "send report.pdf" may become "Send report.pdf", never
     * "report.PDF".
     *
     * @param  list<string>  $names  project names
     * @param  callable(string): string  $change
     */
    public static function outsideLiterals(string $text, array $names, callable $change): string
    {
        $result = '';
        $at = 0;
        foreach (self::literals($text, $names) as [$offset, $length]) {
            if ($offset < $at) {
                continue;
            }
            $result .= $change(substr($text, $at, $offset - $at)).substr($text, $offset, $length);
            $at = $offset + $length;
        }

        return $result.$change(substr($text, $at));
    }

    /** The text opens with a whole phrase of one of the categories ("done …", "move …", "idea: …"). */
    public static function startsWith(string $text, string ...$categories): bool
    {
        return preg_match('~^\s*(?:'.implode('|', array_map(self::phrases(...), $categories)).')(?![\p{L}\p{N}_])~iu', $text) === 1;
    }

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
        return self::$phrasePatterns[$category] ??= self::alternation(self::values($category));
    }

    /** @param list<string> $values */
    private static function alternation(array $values): string
    {
        usort($values, fn (string $a, string $b): int => mb_strlen($b) <=> mb_strlen($a));

        return implode('|', array_map(fn (string $phrase): string => str_replace("'", "['’]", (string) preg_replace('/\s+/', '\s+', preg_quote($phrase, '~'))), $values));
    }

    /** A whole-number quantity, shared by durations, repeat counts and modifier boundaries. */
    public static function integerPattern(): string
    {
        return '\d+|'.self::phrases('amount_one').'|'.implode('|', self::family('amount'));
    }

    public static function integer(string $text): ?int
    {
        if (ctype_digit($text)) {
            $number = filter_var(ltrim($text, '0') ?: '0', FILTER_VALIDATE_INT);

            return $number === false ? null : $number;
        }
        if (preg_match('~^(?:'.self::phrases('amount_one').')$~iu', $text) === 1) {
            return 1;
        }
        foreach (self::family('amount') as $number => $words) {
            if (preg_match('~^(?:'.$words.')$~iu', $text) === 1) {
                return (int) $number;
            }
        }

        return null;
    }

    /** Date, time, priority and repeat words: they describe a task rather than name one (NU §2.2). */
    public const MODIFIER_CATEGORIES = ['signal', 'week_next', 'week_end', 'weekend', 'month_end', 'repeat_unsupported', 'priority_high', 'priority_low'];

    public const MODIFIER_FAMILIES = ['date_offset', 'weekday', 'month', 'repeat', 'time_word'];

    /** One alternation across all these categories, so "every day" wins over "every" wherever each is listed. */
    private static function modifiers(): string
    {
        return self::alternation(self::modifierValues());
    }

    /**
     * A date, time, priority or repeat word, possibly after a day number (26 Oct), a date or clock time (26/10,
     * 9:30), a number with a time unit (9am, 9h30, 3 days), or an hour after "at" (at 14). No delimiters.
     */
    public static function modifierPattern(): string
    {
        if (self::$modifierExpression !== null) {
            return self::$modifierExpression;
        }
        $atom = NoteDurations::expression().'|'.NoteRepeatParser::modifierExpression()
            .'|(?<![\p{L}\p{N}_])(?:\d{1,2}\s+)?(?:'.self::modifiers().')(?![\p{L}\p{N}_])'
            .'|\d+(?:(?:'.self::phrases('time_separator').'|'.self::phrases('full_date_separator').')\d+)+'
            .'|\d+\s*(?:'.self::phrases('time_unit').')(?![\p{L}_])'
            .'|(?<![\p{L}\p{N}_])(?:'.self::phrases('time_prefix').')\s+\d{1,2}(?!\d)';
        $link = self::phrases('span_lead').'|'.self::phrases('time_prefix');

        return self::$modifierExpression = '(?:(?<![\p{L}\p{N}_])(?:'.$link.')\s+)*(?:'.$atom.')';
    }

    /** @param list<string> $names */
    public static function withoutModifiers(string $text, array $names = []): string
    {
        return self::outsideLiterals($text, $names, fn (string $part): string => (string) preg_replace('~'.self::modifierPattern().'~iu', ' ', $part));
    }

    /**
     * "tomorrow 9am", "lặp lại 3 lần": nothing but scheduling, priority and repeat phrases.
     *
     * @param  list<string>  $names
     */
    public static function onlyModifiers(string $text, array $names = []): bool
    {
        return preg_match('/[\p{L}\p{N}\p{So}]/u', self::withoutModifiers(self::withoutLeadIn($text), $names)) !== 1;
    }

    /**
     * A leading date/priority does not hide the task verb in "tomorrow buy milk, eggs".
     *
     * @param  list<string>  $names
     */
    public static function withoutLeadingModifiers(string $text, array $names = []): string
    {
        $literal = self::literals($text, $names)[0] ?? null;
        if ($literal !== null && $literal[0] === 0) {
            return $text;
        }

        return trim((string) preg_replace('~^(?:\s*(?:'.self::modifierPattern().')\s*(?:(?:'.self::phrases('comma').')\s*)?)+~iu', '', $text));
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
        if (isset(self::$families[$family])) {
            return self::$families[$family];
        }
        self::$rules ??= self::load();
        $phrases = [];
        foreach (array_keys(self::$rules) as $category) {
            if (str_starts_with($category, $family.':')) {
                $phrases[substr($category, strlen($family) + 1)] = self::phrases($category);
            }
        }

        return self::$families[$family] = $phrases;
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
