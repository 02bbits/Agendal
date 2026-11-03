<?php

use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Manual\NoteLlmPreview;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    Http::preventStrayRequests();
    $this->context = new NoteContext(new DateTimeImmutable('2026-11-03T08:00:00+07:00'), 'Asia/Ho_Chi_Minh');
    $this->preview = new NoteLlmPreview(['NVIDIA_API_KEY' => 'test-nvidia', 'OPENROUTER_API_KEY' => 'test-openrouter', 'NOTE_LLM_MODEL' => 'test/model']);
});

it('previews only uncertain items through the selected transport', function (string $profile, string $url, bool $native) {
    $response = json_decode(file_get_contents(__DIR__.'/../../Fixtures/note-llm-response.json'), true, flags: JSON_THROW_ON_ERROR);
    Http::fake([$url => Http::response($response)]);
    $text = 'toi can mua sua; call dad tomorrow';
    $rules = app(NoteEngine::class)->build($text, $this->context, budgetMs: 60000);
    $result = $this->preview->run($rules, $text, $this->context, [], $profile, timeout: 90);

    expect($result['build']->engine->value)->toBe('rules_llm')
        ->and(array_column($result['build']->plan['create'], 'title'))->toBe(['Mua sữa', 'Call dad'])
        ->and($result['http'][0]['status'])->toBe(200)
        ->and(config('note_llm.timeout_seconds'))->toBe(30)
        ->and(config('note_llm.prompt_version'))->toBe('note-plan-v6');
    Http::assertSent(function (Request $request) use ($native): bool {
        $input = json_decode($request['messages'][1]['content'], true);
        expect(array_column($input['items'], 'text'))->toBe(['toi can mua sua']);
        if (! $native) {
            expect($request['provider'])->toBe(['require_parameters' => true, 'data_collection' => 'deny']);
        }

        return true;
    });
})->with([
    ['nvidia_super', 'integrate.api.nvidia.com/*', true],
    ['openrouter', 'openrouter.ai/*', false],
]);

it('does not need a key or dispatch a request for confident input', function () {
    Http::fake();
    $rules = app(NoteEngine::class)->build('call dad tomorrow', $this->context, budgetMs: 60000);
    $result = (new NoteLlmPreview([]))->run($rules, 'call dad tomorrow', $this->context, [], 'nvidia_super');
    expect($result['build'])->toBe($rules)->and($result['http'])->toBe([]);
    Http::assertNothingSent();
});

it('retains an honestly labelled rules fallback when the selected provider fails', function () {
    Http::fake(fn () => throw new ConnectionException('Timeout'));
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context, budgetMs: 60000);
    $result = $this->preview->run($rules, 'toi can mua sua', $this->context, [], 'nvidia_super');
    expect($result['build']->engine->value)->toBe('rules_fallback')
        ->and($result['build']->plan['create'])->toBe([])
        ->and($result['build']->plan['skipped'][0]['text'])->toBe('toi can mua sua')
        ->and($result['build']->itemOutcomes['i1']['reason'])->toBe('connection_failed_or_timeout');
});

it('adapts the actual native request body without OpenRouter-specific fields', function () {
    $request = new GuzzleHttp\Psr7\Request('POST', 'https://integrate.api.nvidia.com/v1/chat/completions', [],
        json_encode(['model' => 'test/model', 'provider' => ['data_collection' => 'deny'], 'reasoning' => ['enabled' => false]]));
    $adapted = json_decode((string) NoteLlmPreview::nativeRequest($request)->getBody(), true);
    expect($adapted)->not->toHaveKeys(['provider', 'reasoning'])
        ->and($adapted['chat_template_kwargs'])->toBe(['enable_thinking' => false]);
});

it('does not expose credentials in selectable profile metadata', function () {
    expect(json_encode($this->preview->profiles()))->not->toContain('test-nvidia', 'test-openrouter');
});

it('rejects an invalid custom model ID without dispatching a request', function () {
    Http::fake();
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context, budgetMs: 60000);
    expect(fn () => $this->preview->run($rules, 'toi can mua sua', $this->context, [], 'openrouter_custom', 'https://host/?key=value'))
        ->toThrow(InvalidArgumentException::class);
    Http::assertNothingSent();
});
