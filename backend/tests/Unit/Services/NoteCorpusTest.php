<?php

use Illuminate\Support\Facades\Http;
use Tests\Support\NoteCorpus;
use Tests\TestCase;

uses(TestCase::class);

function corpusCases(): array
{
    return app(NoteCorpus::class)->load(NoteCorpus::files());
}

it('meets the corpus coverage quota', function () {
    expect(app(NoteCorpus::class)->quotas(corpusCases()))->toBe([]);
});

it('meets every accuracy gate in rules mode without provider calls', function () {
    Http::preventStrayRequests();
    $report = app(NoteCorpus::class)->run(corpusCases());

    expect($report['failures'])->toBe([])->and($report['passed'])->toBeTrue()
        ->and($report['llm_notes'])->toBe(0);
    Http::assertNothingSent();
});

it('fails the command gate on a wrong target', function () {
    $case = ['id' => 'wrong', 'categories' => ['command.complete'], 'note' => 'done email group', 'open_tasks' => [['id' => 't1', 'title' => 'Email group']], 'expect' => ['status' => 'done', 'update' => [['task' => 't2', 'done' => true]]]];

    expect(app(NoteCorpus::class)->run([$case])['gates']['commands']['passed'])->toBeFalse()
        ->and(app(NoteCorpus::class)->quotas([]))->not->toBe([]);
});

it('counts a wrong note once rather than diluting it across change kinds', function () {
    $case = ['id' => 'count', 'categories' => ['naming.single'], 'note' => 'call dad', 'expect' => ['status' => 'done']];
    $gate = app(NoteCorpus::class)->run([$case])['gates']['count'];

    expect($gate['total'])->toBe(1)->and($gate['correct'])->toBe(0);
});

it('rejects an unexpected skipped item', function () {
    $case = ['id' => 'skip', 'categories' => ['skip.idea'], 'note' => 'idea: build a tree house', 'expect' => ['status' => 'followup']];

    expect(app(NoteCorpus::class)->run([$case])['gates']['safety']['passed'])->toBeFalse();
});

it('rejects an unexpected ambiguity', function () {
    $case = ['id' => 'tie', 'categories' => ['command.tie'], 'note' => 'done call mum', 'open_tasks' => [['id' => 't1', 'title' => 'Call mum'], ['id' => 't2', 'title' => 'Call mum']], 'expect' => ['status' => 'confirm']];

    expect(app(NoteCorpus::class)->run([$case])['gates']['commands']['passed'])->toBeFalse();
});

it('checks explicitly expected create details', function (string $field, mixed $value) {
    $case = ['id' => 'details', 'categories' => ['naming.single'], 'note' => 'call dad', 'expect' => ['status' => 'confirm', 'create' => [['title' => 'Call dad', $field => $value]]]];

    expect(app(NoteCorpus::class)->run([$case])['gates']['details']['passed'])->toBeFalse();
})->with([
    'end time' => ['end', '17:00'],
    'notes overflow' => ['notes', 'Must not be ignored'],
    'duplicate target' => ['duplicate_of', 't1'],
]);
