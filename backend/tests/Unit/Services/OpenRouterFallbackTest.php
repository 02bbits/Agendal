<?php

use App\Services\Clock\ClockInterface;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\OpenRouterFallback;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    config(['note_llm.enabled' => true, 'note_llm.key' => 'test-only', 'note_llm.model' => 'test/model']);
    Cache::flush();
    Http::preventStrayRequests();
    $this->context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
});

function recordedNoteResponse(): array
{
    return json_decode(file_get_contents(__DIR__.'/../../Fixtures/note-llm-response.json'), true, flags: JSON_THROW_ON_ERROR);
}

it('sends only uncertain items with privacy and schema restrictions (SEC-40, SEC-43)', function () {
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    $text = 'toi can mua sua; call dad';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    $result = app(OpenRouterFallback::class)->resolve($rules, $text, $this->context, [], 1);
    expect($result['engine'])->toBe('rules_llm');
    expect(array_column($result['plan']['create'], 'title'))->toBe(['Mua sữa', 'Call dad']);
    Http::assertSent(function (Request $request): bool {
        expect($request['provider'])->toBe(['require_parameters' => true, 'data_collection' => 'deny']);
        expect($request['response_format']['json_schema']['strict'])->toBeTrue();
        expect($request['messages'][1]['content'])->not->toContain('call dad', 'email', 'display_name', 'task_notes');

        return true;
    });
});

it('does not call the provider for confident notes or when disabled', function () {
    Http::fake();
    $rules = app(NoteEngine::class)->build('call mum', $this->context);
    expect(app(OpenRouterFallback::class)->resolve($rules, 'call mum', $this->context, [], 1)['engine'])->toBe('rules');
    config(['note_llm.enabled' => false]);
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    expect(app(OpenRouterFallback::class)->resolve($rules, 'toi can mua sua', $this->context, [], 1)['engine'])->toBe('rules');
    Http::assertNothingSent();
});

it('falls back on provider failure or invalid output (T-NU-127)', function (string $failure) {
    Http::fake(fn () => match ($failure) {
        'timeout' => throw new ConnectionException('Timeout'),
        'down' => Http::response([], 503),
        'invalid-json' => Http::response(['choices' => [['message' => ['content' => '{']]]]),
        default => Http::response(['choices' => [['message' => ['content' => '{"items":[{}]}']]]]),
    });
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    $result = app(OpenRouterFallback::class)->resolve($rules, 'toi can mua sua', $this->context, [], 1);
    expect($result['engine'])->toBe('rules_fallback')->and($result['plan'])->toBe($rules['plan']);
})->with(['timeout', 'down', 'invalid-json', 'invalid-schema']);

it('rejects task IDs outside the supplied candidate set (SEC-41)', function () {
    $response = recordedNoteResponse();
    $response['choices'][0]['message']['content'] = json_encode(['items' => [[
        'ref' => 'i1', 'action' => 'delete', 'task_id' => (string) Str::uuid(), 'title' => null,
        'due_date' => null, 'start_time' => null, 'end_time' => null, 'priority' => null,
        'project' => null, 'repeat' => 'never', 'reminder' => 'none',
    ]]]);
    Http::fake(['openrouter.ai/*' => Http::response($response)]);
    $rules = app(NoteEngine::class)->build('delete absent task', $this->context);
    $result = app(OpenRouterFallback::class)->resolve($rules, 'delete absent task', $this->context, [], 1);
    expect($result['plan']['delete'])->toBe([])->and($result['engine'])->toBe('rules_fallback');
});

it('enforces per-user and global budgets before dispatch (SEC-42)', function () {
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    config(['note_llm.daily_user_calls' => 1]);
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    $fallback = app(OpenRouterFallback::class);
    expect($fallback->resolve($rules, 'toi can mua sua', $this->context, [], 1)['engine'])->toBe('rules_llm');
    expect($fallback->resolve($rules, 'toi can mua sua', $this->context, [], 1)['engine'])->toBe('rules_fallback');
    config(['note_llm.daily_tokens' => 1]);
    expect($fallback->resolve($rules, 'toi can mua sua', $this->context, [], 2)['engine'])->toBe('rules_fallback');
    Http::assertSentCount(1);
});
