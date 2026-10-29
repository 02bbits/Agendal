<?php

use App\Services\Clock\ClockInterface;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Support\FrozenClock;
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

it('meets every accuracy gate in rules mode', function () {
    $report = app(NoteCorpus::class)->run(corpusCases());

    expect($report['failures'])->toBe([])->and($report['passed'])->toBeTrue();
});

it('meets every LLM gate with a recorded provider answer and the provider down otherwise', function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    config(['note_llm.enabled' => true, 'note_llm.key' => 'test-only', 'note_llm.model' => 'test/model']);
    Cache::flush();
    Http::preventStrayRequests();
    $recorded = json_decode((string) file_get_contents(__DIR__.'/../../Fixtures/note-llm-response.json'), true);
    Http::fake(function (Request $request) use ($recorded) {
        $items = json_decode($request['messages'][1]['content'], true)['items'];

        return count($items) === 1 && $items[0]['text'] === 'toi can mua sua' ? Http::response($recorded) : Http::response([], 503);
    });
    $report = app(NoteCorpus::class)->run(corpusCases(), withModel: true);

    expect($report['llm_notes'])->toBeGreaterThan(0)->and($report['passed'])->toBeTrue(json_encode($report['gates']));
});

it('fails the command gate on a wrong target', function () {
    $case = ['id' => 'wrong', 'categories' => ['command.complete'], 'note' => 'done email group', 'open_tasks' => [['id' => 't1', 'title' => 'Email group']], 'expect' => ['status' => 'done', 'update' => [['task' => 't2', 'done' => true]]]];

    expect(app(NoteCorpus::class)->run([$case])['gates']['commands']['passed'])->toBeFalse()
        ->and(app(NoteCorpus::class)->quotas([]))->not->toBe([]);
});

it('fails LLM mode when no proposal was accepted', function () {
    $case = ['id' => 'simple', 'categories' => ['naming.single'], 'note' => 'call dad', 'expect' => ['status' => 'done', 'create' => [['title' => 'Call dad']]]];

    expect(app(NoteCorpus::class)->run([$case], withModel: true)['passed'])->toBeFalse();
});

// Nightly only (.github/workflows/note-corpus-nightly.yml): a real provider call, never in CI.
it('meets every LLM gate with the live provider', function () {
    $report = app(NoteCorpus::class)->run(corpusCases(), withModel: true);

    expect($report['passed'])->toBeTrue(json_encode($report['gates']));
})->group('corpus-live')->skip(fn (): bool => env('NOTE_CORPUS_LIVE') !== 'true', 'Set NOTE_CORPUS_LIVE=true with an OpenRouter key to run');
