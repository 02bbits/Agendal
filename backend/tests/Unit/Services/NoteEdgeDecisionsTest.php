<?php

use Tests\Support\NoteCorpus;
use Tests\TestCase;

uses(TestCase::class);

dataset('NU edge decisions', array_combine(
    array_map(fn (int $edge): string => 'T-NU-'.(100 + $edge).' / NU-E'.$edge, range(1, 41)),
    range(1, 41),
));

it('implements the documented rules decision', function (int $edge) {
    if ($edge === 27) {
        $this->markTestSkipped('NU-E27 requires IM-38 provider failures; LLM is temporarily disabled.');
    }

    $runner = app(NoteCorpus::class);
    $cases = array_values(array_filter(
        $runner->load(NoteCorpus::files()),
        fn (array $case): bool => in_array('edge.NU-E'.$edge, $case['categories'], true),
    ));

    expect($cases)->not->toBe([]);
    $report = $runner->run($cases);
    expect($report['failures'])->toBe([])->and($report['passed'])->toBeTrue();
})->with('NU edge decisions');
