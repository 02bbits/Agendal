<?php

declare(strict_types=1);

namespace Tests\Support;

use Normalizer;
use RuntimeException;

/** Dynamic test scenarios generated from every splitter rule. */
final class NoteSplitterScenarios
{
    /** @return array<string, array<mixed>> */
    public static function generate(string $rulesPath, int $maxLength, int $maxItems): array
    {
        $cases = [...self::rules($rulesPath), ...self::boundaries($maxLength, $maxItems)];
        foreach ($cases as $name => $case) {
            $cases[$name] = count($case) === 4 ? $case : [...$case, []];
        }
        foreach (['Portfolio', 'SQL Course', 'Research (2026)', 'R&D+', 'Đồ án cá nhân'] as $project) {
            $cases['project / '.$project] = ['buy widget, '.$project.' outline', ['buy widget', $project.' outline'], '', [$project]];
        }
        foreach (range(0, 31) as $code) {
            if (! in_array($code, [9, 10, 13], true)) {
                $cases['control character '.$code] = ['read'.chr($code).' widget', ['read widget'], '', []];
            }
        }
        foreach (["\u{200B}", "\u{200C}", "\u{200D}", "\u{FEFF}"] as $character) {
            $cases['invisible '.bin2hex($character)] = [$character.' . ; ', [], 'note.empty', []];
        }

        return $cases;
    }

    /** @return array<string, array<mixed>> */
    private static function rules(string $path): array
    {
        $file = fopen($path, 'rb');
        if ($file === false) {
            throw new RuntimeException('Missing backend/resources/notes/splitter-rules.csv');
        }
        try {
            $header = fgetcsv($file, null, ',', '"', '');
            if (is_array($header)) {
                $header[0] = ltrim((string) $header[0], "\xEF\xBB\xBF");
            }
            if ($header !== ['category', 'value']) {
                throw new RuntimeException('Invalid rules CSV header');
            }
            $cases = [];
            while (($row = fgetcsv($file, null, ',', '"', '')) !== false) {
                if ($row === [null]) {
                    continue;
                }
                if (count($row) !== 2 || ! is_string($row[0]) || ! is_string($row[1]) || trim($row[1]) === '') {
                    throw new RuntimeException('Invalid rules CSV row');
                }
                [$category, $value] = $row;
                $project = str_starts_with($category, 'project_keyword:') ? substr($category, strlen('project_keyword:')) : null;
                $examples = $project !== null ? [
                    // NU-E34: a keyword is a signal only for a project the user has.
                    ['buy widget, '.$value.' gadget', ['buy widget', $value.' gadget'], [$project]],
                    ['buy widget, '.$value.' gadget', ['buy widget, '.$value.' gadget'], []],
                ] : match ($category) {
                    'task_verb' => [
                        [$value.' widget, gadget', [$value.' widget, gadget']],
                        ['buy widget, '.$value.' gadget', ['buy widget', $value.' gadget']],
                    ],
                    'complete_command', 'move_command', 'delete_command', 'skip_prefix', 'signal' => [
                        ['buy widget, '.$value.' gadget', ['buy widget', $value.' gadget']],
                    ],
                    'abbreviation' => [
                        ['meet '.$value.'. Lee. call mum', ['meet '.$value.'. Lee', 'call mum']],
                    ],
                    'bullet' => [
                        [$value.' [ ] read widget'."\n".$value.' call mum', ['read widget', 'call mum']],
                        [$value.'5 widget', [$value.'5 widget']],
                    ],
                    'tight_bullet' => [
                        [$value.'read widget'."\n".$value.' call mum', ['read widget', 'call mum']],
                    ],
                    'checkbox_bracket' => [
                        [mb_substr($value, 0, 1).' '.mb_substr($value, 1).' read widget'."\n".mb_substr($value, 0, 1).'x'.mb_substr($value, 1).' call mum', ['read widget', 'call mum']],
                    ],
                    'separator' => [
                        ['buy widget'.$value.'gadget', ['buy widget', 'gadget']],
                    ],
                    'conjunction' => [
                        ['buy widget '.$value.' call mum', ['buy widget', 'call mum']],
                        ['visit alpha'.$value.'beta', ['visit alpha'.$value.'beta']],
                    ],
                    'following_conjunction' => [
                        ['buy widget '.$value.' call mum', ['buy widget', 'call mum']],
                        ['read widget '.$value, ['read widget '.$value]],
                        ['visit alpha'.$value.'beta', ['visit alpha'.$value.'beta']],
                    ],
                    'time_unit' => [
                        ['buy widget, gadget 3'.$value, ['buy widget', 'gadget 3'.$value]],
                        ['buy widget, 3 '.$value.'x', ['buy widget, 3 '.$value.'x']],
                    ],
                    'time_prefix' => [
                        ['buy widget, gadget '.$value.' 9', ['buy widget', 'gadget '.$value.' 9']],
                    ],
                    'complete_suffix' => [
                        ['buy widget, gadget '.$value, ['buy widget', 'gadget '.$value]],
                    ],
                    'lead_in' => [
                        [$value.' buy widget, gadget', [$value.' buy widget, gadget']],
                        ['buy widget, '.$value.' call gadget', ['buy widget', $value.' call gadget']],
                    ],
                    'list_joiner' => [
                        ['buy widget, '.$value.' gadget', ['buy widget, '.$value.' gadget']],
                        ['buy widget, '.$value.' call gadget', ['buy widget', 'call gadget']],
                        ['buy widget '.$value.' then call gadget', ['buy widget', 'call gadget']],
                    ],
                    'number_suffix' => [
                        ['3'.$value.' read widget'."\n".'12'.$value.' call mum', ['read widget', 'call mum']],
                    ],
                    'letter_suffix' => [
                        ['b'.$value.' read widget', ['read widget']],
                    ],
                    'checkbox_mark' => [
                        ['['.$value.'] read widget'."\n".'[ '.$value.' ] call mum', ['read widget', 'call mum']],
                    ],
                    'comma' => [
                        ['buy widget'.$value.' gadget'.$value.' call mum', ['buy widget'.$value.' gadget', 'call mum']],
                        ['pay 1'.$value.'000 for widget', ['pay 1'.$value.'000 for widget']],
                    ],
                    'full_stop' => [
                        ['buy widget'.$value.' call mum'.$value, ['buy widget', 'call mum']],
                    ],
                    'time_separator' => [
                        ['buy widget, gadget 9'.$value.'30', ['buy widget', 'gadget 9'.$value.'30']],
                    ],
                    'word_attachment' => [
                        ['email alpha'.$value.'then about widget', ['email alpha'.$value.'then about widget']],
                        ['email then'.$value.'alpha about widget', ['email then'.$value.'alpha about widget']],
                    ],
                    default => throw new RuntimeException('Add scenario templates for new rule category '.$category),
                };
                foreach ($examples as $index => $example) {
                    [$note, $expected] = $example;
                    $projects = $example[2] ?? [];
                    foreach (['original', 'uppercase', 'padded', 'decomposed'] as $variant) {
                        $input = match ($variant) {
                            'uppercase' => mb_strtoupper($note),
                            'padded' => " \t".$note."\t ",
                            'decomposed' => Normalizer::normalize($note, Normalizer::FORM_D),
                            default => $note,
                        };
                        $output = array_map(fn (string $item): string => $variant === 'uppercase' ? mb_strtoupper($item) : $item, $expected);
                        $key = $category.' / '.$value.' / '.$index.' / '.$variant;
                        if (isset($cases[$key])) {
                            throw new RuntimeException('Duplicate rule '.$category.': '.$value);
                        }
                        $cases[$key] = [(string) $input, $output, '', $projects];
                    }
                }
            }
            if ($cases === []) {
                throw new RuntimeException('No dynamic rules found');
            }

            return $cases;
        } finally {
            fclose($file);
        }
    }

    /** @return array<string, array<mixed>> */
    private static function boundaries(int $maxLength, int $maxItems): array
    {
        $cases = [];
        foreach ([1, $maxItems - 1, $maxItems, $maxItems + 1] as $count) {
            $items = array_map(fn (int $index): string => 'read chapter '.$index, range(1, $count));
            foreach (["\n", "\r\n", "\r", ';', '. ', ' then ', ' rồi ', ' sau đó ', ', '] as $separator) {
                $cases['count '.$count.' separator '.json_encode($separator)] = [implode($separator, $items), $count <= $maxItems ? $items : [], $count > $maxItems ? 'note.too_many_items' : ''];
            }
        }
        // Comma fragments are counted after merging, unlike hard boundaries.
        $cases['comma objects past the item limit merge into one'] = ['buy '.implode(', ', array_fill(0, $maxItems + 1, 'widget')), ['buy '.implode(', ', array_fill(0, $maxItems + 1, 'widget'))], ''];
        foreach (['a', 'ế', '😀'] as $character) {
            foreach ([$maxLength - 1, $maxLength, $maxLength + 1] as $length) {
                $note = str_repeat($character, $length);
                $cases[$character.' length '.$length] = [$note, $length <= $maxLength ? [$note] : [], $length > $maxLength ? 'note.too_long' : ''];
            }
        }
        $cases['NFC length is checked after normalization'] = [str_repeat("e\u{0302}\u{0301}", $maxLength), [str_repeat('ế', $maxLength)], ''];

        foreach (range(1, 23) as $hour) {
            foreach (['00', '15', '30', '45'] as $minute) {
                $first = 'meet Dr. Lee at '.$hour.'.'.$minute;
                $second = 'pay '.number_format($hour * 1000).' for report.pdf';
                $cases['numeric '.$hour.':'.$minute] = [$first.'; '.$second, [$first, $second], ''];
            }
        }

        return $cases;
    }
}
