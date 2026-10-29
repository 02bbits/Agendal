<?php

declare(strict_types=1);

namespace App\Console\Support;

use Normalizer;
use RuntimeException;

/** Developer scenarios used by both the Artisan command and Pest. */
final class NoteSplitterScenarios
{
    /** @return array<string, array<mixed>> */
    public static function generate(string $rulesPath): array
    {
        $cases = [...self::rules($rulesPath), ...self::boundaries()];
        foreach ($cases as $name => $case) {
            $cases[$name] = [...$case, []];
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
                $examples = match ($category) {
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
                    default => throw new RuntimeException('Add scenario templates for new rule category '.$category),
                };
                foreach ($examples as $index => [$note, $expected]) {
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
                        $cases[$key] = [(string) $input, $output, ''];
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
    private static function boundaries(): array
    {
        $cases = [];
        foreach ([1, 29, 30, 31] as $count) {
            $items = array_map(fn (int $index): string => 'read chapter '.$index, range(1, $count));
            foreach (["\n", "\r\n", "\r", ';', '. ', ' then ', ' rồi ', ' sau đó ', ', '] as $separator) {
                $cases['count '.$count.' separator '.json_encode($separator)] = [implode($separator, $items), $count <= 30 ? $items : [], $count > 30 ? 'note.too_many_items' : ''];
            }
        }
        // Comma fragments are counted after merging, unlike hard boundaries.
        $cases['31 comma objects merge into one'] = ['buy '.implode(', ', array_fill(0, 31, 'widget')), ['buy '.implode(', ', array_fill(0, 31, 'widget'))], ''];
        foreach (['a', 'ế', '😀'] as $character) {
            foreach ([4999, 5000, 5001] as $length) {
                $note = str_repeat($character, $length);
                $cases[$character.' length '.$length] = [$note, $length <= 5000 ? [$note] : [], $length > 5000 ? 'note.too_long' : ''];
            }
        }
        $cases['NFC length is checked after normalization'] = [str_repeat("e\u{0302}\u{0301}", 5000), [str_repeat('ế', 5000)], ''];

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
