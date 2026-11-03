<?php

use App\Services\Notes\NoteSplitter;
use Illuminate\Validation\ValidationException;
use Tests\Support\Cases;
use Tests\Support\NoteSplitterScenarios;
use Tests\TestCase;

uses(TestCase::class);

it('handles the generated rule and boundary scenarios', function () {
    $config = config('notes');
    $scenarios = NoteSplitterScenarios::generate($config['rules'], $config['max_length'], $config['max_items']);

    expect(Cases::failing($scenarios, function (string $note, array $expected, string $error, array $projects): mixed {
        try {
            $items = (new NoteSplitter)->split($note, $projects);

            return $error === '' && $items === $expected ? null : $items;
        } catch (ValidationException $exception) {
            return $exception->errors() === ['text' => [$error]] ? null : $exception->errors();
        }
    }))->toBe([]);
});
