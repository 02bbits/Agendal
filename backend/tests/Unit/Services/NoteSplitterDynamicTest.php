<?php

use App\Services\Notes\NoteSplitter;
use Illuminate\Validation\ValidationException;
use Tests\Support\NoteSplitterScenarios;
use Tests\TestCase;

uses(TestCase::class);

dataset('dynamic splitter scenarios', function (): array {
    // Datasets build before the app boots, so read the config file directly.
    $config = require __DIR__.'/../../../config/notes.php';

    return NoteSplitterScenarios::generate($config['rules'], $config['max_length'], $config['max_items']);
});

it('handles the generated rule and boundary scenarios', function (string $note, array $expected, string $error, array $projects) {
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
})->with('dynamic splitter scenarios');
