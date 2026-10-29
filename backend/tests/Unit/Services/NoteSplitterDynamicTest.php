<?php

use App\Console\Support\NoteSplitterScenarios;
use App\Services\Notes\NoteSplitter;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

dataset('dynamic splitter scenarios', fn (): array => NoteSplitterScenarios::generate(__DIR__.'/../../../resources/notes/splitter-rules.csv'));

it('runs the same generated scenarios as the developer command', function (string $note, array $expected, string $error, array $projects) {
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
