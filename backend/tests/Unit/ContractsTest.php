<?php

use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;

// IM-02: every fixture must match its schema. A fixture uses the schema whose name it starts with.
const CONTRACTS = __DIR__.'/../../../docs/07-architecture/contracts';

function contractsValidator(): Validator
{
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', CONTRACTS.'/schemas/');

    return $validator;
}

function schemaFor(string $fixture): string
{
    $names = array_map(fn ($path) => basename($path, '.schema.json'), glob(CONTRACTS.'/schemas/*.schema.json'));
    $matches = array_filter($names, fn ($name) => str_starts_with($fixture, $name));
    usort($matches, fn ($a, $b) => strlen($b) <=> strlen($a));

    return $matches[0] ?? throw new RuntimeException("No schema for fixture {$fixture}");
}

dataset('fixtures', fn () => array_map(fn ($path) => basename($path, '.json'), glob(CONTRACTS.'/fixtures/*.json')));

it('matches its schema', function (string $fixture) {
    $data = json_decode(file_get_contents(CONTRACTS."/fixtures/{$fixture}.json"), flags: JSON_THROW_ON_ERROR);
    $result = contractsValidator()->validate($data, 'https://agendal.app/schemas/'.schemaFor($fixture).'.schema.json');

    expect($result->isValid())->toBeTrue(
        $result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error()), JSON_PRETTY_PRINT)
    );
})->with('fixtures');

it('rejects data that breaks the contract', function () {
    $data = json_decode(file_get_contents(CONTRACTS.'/fixtures/note-result-done.json'));
    $data->note->status = 'weird';

    expect(contractsValidator()->validate($data, 'https://agendal.app/schemas/note-result.schema.json')->isValid())->toBeFalse();
});
