<?php

use App\Services\Notes\NoteSplitter;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

dataset('note splitter CSV scenarios', function (): array {
    $file = fopen(__DIR__.'/../../Fixtures/note-splitter-scenarios.csv', 'rb');
    if ($file === false) {
        throw new RuntimeException('Cannot read note splitter scenarios');
    }
    try {
        $header = fgetcsv($file, null, ',', '"', '');
        if (is_array($header)) {
            $header[0] = ltrim((string) $header[0], "\xEF\xBB\xBF");
        }
        if ($header !== ['id', 'note', 'projects_json', 'expected_json', 'error']) {
            throw new RuntimeException('Invalid scenario CSV header');
        }
        $cases = [];
        while (($row = fgetcsv($file, null, ',', '"', '')) !== false) {
            if ($row === [null]) {
                continue;
            }
            if (count($row) !== 5 || ! is_string($row[0]) || $row[0] === '' || isset($cases[$row[0]])) {
                throw new RuntimeException('Scenario CSV needs five columns and unique, nonempty IDs');
            }
            try {
                $projects = json_decode((string) $row[2], true, flags: JSON_THROW_ON_ERROR);
                $expected = json_decode((string) $row[3], true, flags: JSON_THROW_ON_ERROR);
            } catch (JsonException $error) {
                throw new RuntimeException('Invalid JSON in CSV scenario '.$row[0], previous: $error);
            }
            foreach ([$projects, $expected] as $list) {
                if (! is_array($list) || ! array_is_list($list) || count(array_filter($list, 'is_string')) !== count($list)) {
                    throw new RuntimeException('Projects and expected items must be JSON arrays of strings');
                }
            }
            if (! in_array($row[4], ['', 'note.empty', 'note.too_long', 'note.too_many_items'], true)) {
                throw new RuntimeException('Unknown expected note error');
            }
            $cases[$row[0]] = [(string) $row[1], $projects, $expected, (string) $row[4]];
        }
        if ($cases === []) {
            throw new RuntimeException('No note scenarios found');
        }

        return $cases;
    } finally {
        fclose($file);
    }
});

it('follows documented splitting rules for an editable CSV scenario (T-NU-01–07, T-NU-120)', function (string $note, array $projects, array $expected, string $error) {
    if ($error === '') {
        expect((new NoteSplitter)->split($note, $projects))->toBe($expected);

        return;
    }
    try {
        (new NoteSplitter)->split($note, $projects);
        $this->fail('Expected '.$error);
    } catch (ValidationException $exception) {
        expect($exception->errors())->toBe(['text' => [$error]]);
    }
})->with('note splitter CSV scenarios');

it('rejects invisible, overlong and overfull notes', function (string $text, string $key) {
    try {
        (new NoteSplitter)->split($text);
        $this->fail('Expected a note validation error');
    } catch (ValidationException $error) {
        expect($error->errors())->toBe(['text' => [$key]]);
    }
})->with(function (): array {
    $config = require __DIR__.'/../../../config/notes.php';

    return [
        [" . ; \u{200B}", 'note.empty'],
        ['then', 'note.empty'],
        [str_repeat('a', $config['max_length'] + 1), 'note.too_long'],
        [implode(';', array_fill(0, $config['max_items'] + 1, 'call mum')), 'note.too_many_items'],
    ];
});

it('normalizes decomposed accents and keeps newlines and tabs', function () {
    expect((new NoteSplitter)->normalize("  go\u{0323}i\tme\u{0323}\r\n\x01đọc "))->toBe("gọi\tmẹ\nđọc");
});
