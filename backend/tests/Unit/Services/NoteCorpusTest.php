<?php

use App\Services\Clock\ClockInterface;
use App\Services\Notes\CorpusRunner;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Support\FrozenClock;
use Tests\TestCase;

uses(TestCase::class);

it('meets corpus quotas and every rules accuracy gate', function () {
    $runner = app(CorpusRunner::class);
    $cases = $runner->load(glob(base_path('../docs/06-testing/note-corpus/*.yaml')));
    expect($runner->quotas($cases))->toBe([]);
    $report = $runner->run($cases);
    expect($report['failures'])->toBe([])->and($report['passed'])->toBeTrue();
});

it('meets LLM gates using recorded output plus provider-down fallback', function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    config(['note_llm.enabled' => true, 'note_llm.key' => 'test-only', 'note_llm.model' => 'test/model']);
    Cache::flush();
    Http::preventStrayRequests();
    $fixture = json_decode(file_get_contents(__DIR__.'/../../Fixtures/note-llm-response.json'), true);
    Http::fake(function (Request $request) use ($fixture) {
        $input = json_decode($request['messages'][1]['content'], true);

        return count($input['items']) === 1 && $input['items'][0]['ref'] === 'i1' && $input['items'][0]['text'] === 'toi can mua sua'
            ? Http::response($fixture) : Http::response([], 503);
    });
    $runner = app(CorpusRunner::class);
    $report = $runner->run($runner->load(glob(base_path('../docs/06-testing/note-corpus/*.yaml'))), 'llm');
    expect($report['llm_notes'])->toBeGreaterThan(0)->and($report['passed'])->toBeTrue(json_encode($report['gates']));
});

it('fails quotas and reports deliberately wrong command targets', function () {
    $runner = app(CorpusRunner::class);
    expect($runner->quotas([]))->not->toBe([]);
    $case = ['id' => 'wrong', 'categories' => ['command.complete'], 'note' => 'done email group', 'open_tasks' => [['id' => 't1', 'title' => 'Email group']], 'expect' => ['status' => 'done', 'update' => [['task' => 't2', 'done' => true]]]];
    $report = $runner->run([$case]);
    expect($report['passed'])->toBeFalse()->and($report['gates']['commands']['passed'])->toBeFalse();
});

it('fails LLM mode when no proposal was actually accepted', function () {
    $runner = app(CorpusRunner::class);
    $case = ['id' => 'simple', 'categories' => ['naming.single'], 'note' => 'call dad', 'expect' => ['status' => 'done', 'create' => [['title' => 'Call dad']]]];
    expect($runner->run([$case], 'llm')['passed'])->toBeFalse();
});
