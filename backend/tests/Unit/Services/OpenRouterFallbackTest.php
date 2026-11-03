<?php

use App\Enums\PlanStatus;
use App\Services\Clock\ClockInterface;
use App\Services\Notes\NoteBuild;
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
    config(['note_llm.enabled' => true, 'note_llm.key' => 'test-only', 'note_llm.model' => 'test/model', 'note_llm.prompt_version' => 'note-plan-v2']);
    Cache::flush();
    Http::preventStrayRequests();
    $this->context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
});

function recordedNoteResponse(): array
{
    return json_decode(file_get_contents(__DIR__.'/../../Fixtures/note-llm-response.json'), true, flags: JSON_THROW_ON_ERROR);
}

function modelNoteResponse(array $proposals): array
{
    $response = recordedNoteResponse();
    $template = json_decode($response['choices'][0]['message']['content'], true, flags: JSON_THROW_ON_ERROR)['items'][0];
    $response['choices'][0]['message']['content'] = json_encode(['items' => array_map(
        fn (array $proposal): array => [...$template, 'repeat_rule' => null, 'copies' => 1, ...$proposal], $proposals,
    )], JSON_THROW_ON_ERROR);

    return $response;
}

it('sends only uncertain items with privacy and schema restrictions (SEC-40, SEC-43)', function () {
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    $text = 'toi can mua sua; call dad';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect($result->engine->value)->toBe('rules_llm');
    expect(array_column($result->plan['create'], 'title'))->toBe(['Mua sữa', 'Call dad']);
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
    expect(app(OpenRouterFallback::class)->improve($rules, 'call mum', $this->context, [], 1)->engine->value)->toBe('rules');
    config(['note_llm.enabled' => false]);
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    expect(app(OpenRouterFallback::class)->improve($rules, 'toi can mua sua', $this->context, [], 1)->engine->value)->toBe('rules_fallback');
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
    $result = app(OpenRouterFallback::class)->improve($rules, 'toi can mua sua', $this->context, [], 1);
    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
})->with(['timeout', 'down', 'invalid-json', 'invalid-schema']);

it('rejects task IDs outside the supplied candidate set (SEC-41)', function () {
    $response = recordedNoteResponse();
    $response['choices'][0]['message']['content'] = json_encode(['items' => [[
        'ref' => 'i1', 'action' => 'delete', 'task_id' => (string) Str::uuid(), 'title' => null,
        'due_date' => null, 'start_time' => null, 'end_time' => null, 'priority' => null,
        'project' => null, 'repeat' => 'never', 'repeat_rule' => null, 'copies' => 1, 'reminder' => 'none',
    ]]]);
    Http::fake(['openrouter.ai/*' => Http::response($response)]);
    $rules = app(NoteEngine::class)->build('delete absent task', $this->context);
    $result = app(OpenRouterFallback::class)->improve($rules, 'delete absent task', $this->context, [], 1);
    expect($result->plan['delete'])->toBe([])->and($result->engine->value)->toBe('rules_fallback');
});

it('enforces per-user and global budgets before dispatch (SEC-42)', function () {
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    config(['note_llm.daily_user_calls' => 1]);
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    $fallback = app(OpenRouterFallback::class);
    expect($fallback->improve($rules, 'toi can mua sua', $this->context, [], 1)->engine->value)->toBe('rules_llm');
    expect($fallback->improve($rules, 'toi can mua sua', $this->context, [], 1)->engine->value)->toBe('rules_fallback');
    config(['note_llm.daily_tokens' => 1]);
    expect($fallback->improve($rules, 'toi can mua sua', $this->context, [], 2)->engine->value)->toBe('rules_fallback');
    Http::assertSentCount(1);
});

it('replaces only the uncertain item and records the prompt version', function () {
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    $text = 'toi can mua sua; call dad tomorrow';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect(array_column($result->plan['create'], 'ref'))->toBe(['i1', 'i2'])
        ->and($result->promptVersion)->toBe(config('note_llm.prompt_version'));
});

it('reads the endpoint and limits from config', function () {
    config(['note_llm.url' => 'https://llm.example.test/v1/chat', 'note_llm.max_completion_tokens' => 64, 'note_llm.reasoning_enabled' => false]);
    Http::fake(['llm.example.test/*' => Http::response(recordedNoteResponse())]);
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    app(OpenRouterFallback::class)->improve($rules, 'toi can mua sua', $this->context, [], 1);

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://llm.example.test/v1/chat' && $request['max_tokens'] === 64
        && $request['reasoning'] === ['enabled' => false]);
});

it('omits the reasoning parameter when the model has no configured preference', function () {
    config(['note_llm.reasoning_enabled' => null]);
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    app(OpenRouterFallback::class)->improve($rules, 'toi can mua sua', $this->context, [], 1);

    Http::assertSent(fn (Request $request): bool => ! array_key_exists('reasoning', $request->data()));
});

it('keeps the confirm step when improving an unrelated uncertain item', function () {
    Http::fake(['openrouter.ai/*' => Http::response(recordedNoteResponse())]);
    $text = 'toi can mua sua; call dad';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    $rules = new NoteBuild(
        [...$rules->plan, 'needs_confirm' => true], PlanStatus::Confirm,
        $rules->name, $rules->engine, $rules->lowConfidence,
    );

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_llm')
        ->and($result->plan['needs_confirm'])->toBeTrue()
        ->and($result->status)->toBe(PlanStatus::Confirm);
});

it('labels a model reschedule using the current note result copy', function () {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum', 'due_date' => '2026-10-23', 'start_time' => '09:00'];
    $text = 'doi call mum sang thu sau';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    $rules = new NoteBuild($rules->plan, $rules->status, $rules->name, $rules->engine, ['i1' => $text]);
    $response = recordedNoteResponse();
    $response['choices'][0]['message']['content'] = json_encode(['items' => [[
        'ref' => 'i1', 'action' => 'reschedule', 'task_id' => $task['id'], 'title' => null,
        'due_date' => '2026-10-30', 'start_time' => null, 'end_time' => null, 'priority' => null,
        'project' => null, 'repeat' => 'never', 'repeat_rule' => null, 'copies' => 1, 'reminder' => 'none',
    ]]]);
    Http::fake(['openrouter.ai/*' => Http::response($response)]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task], 1);

    expect($result->engine->value)->toBe('rules_llm')
        ->and($result->plan['update'][0]['label'])->toBe('Due Fri 30 Oct 09:00');
});

it('keeps the rules result if the configured prompt cannot be read', function () {
    config(['note_llm.prompt_version' => 'missing-test-prompt']);
    Http::fake();
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);

    $result = app(OpenRouterFallback::class)->improve($rules, 'toi can mua sua', $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
    Http::assertNothingSent();
});

it('keeps the rules result if the budget cache is unavailable', function () {
    Http::fake();
    $rules = app(NoteEngine::class)->build('toi can mua sua', $this->context);
    Cache::shouldReceive('lock')->once()->andThrow(new RuntimeException('Cache unavailable'));

    $result = app(OpenRouterFallback::class)->improve($rules, 'toi can mua sua', $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
    Http::assertNothingSent();
});

it('normalizes model reschedules like rules reschedules', function (array $old, array $proposed, array $expected) {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum', ...$old];
    $text = 'doi call mum sang thu sau';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    $rules = new NoteBuild($rules->plan, $rules->status, $rules->name, $rules->engine, ['i1' => $text]);
    $response = recordedNoteResponse();
    $response['choices'][0]['message']['content'] = json_encode(['items' => [[
        'ref' => 'i1', 'action' => 'reschedule', 'task_id' => $task['id'], 'title' => null,
        'due_date' => null, 'start_time' => null, 'end_time' => null, 'priority' => null,
        'project' => null, 'repeat' => 'never', 'repeat_rule' => null, 'copies' => 1, 'reminder' => 'none', ...$proposed,
    ]]]);
    Http::fake(['openrouter.ai/*' => Http::response($response)]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task], 1);

    expect($result->engine->value)->toBe('rules_llm');
    if (isset($expected['reason'])) {
        expect($result->plan['update'])->toBe([])
            ->and($result->plan['skipped'][0]['reason'])->toBe($expected['reason'])
            ->and($result->status)->toBe(PlanStatus::Done);
    } else {
        expect($result->plan['update'][0])->toMatchArray($expected);
    }
})->with([
    'same date' => [['due_date' => '2026-10-26'], ['due_date' => '2026-10-26'], ['reason' => 'no_change']],
    'keep duration' => [
        ['due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '10:00'],
        ['start_time' => '09:30'], ['start_time' => '09:30', 'end_time' => '10:30', 'label' => 'Due Mon 26 Oct 09:30'],
    ],
    'end crosses midnight' => [
        ['due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '10:00'],
        ['start_time' => '23:30'], ['start_time' => '23:30', 'end_time' => null],
    ],
    'time on undated task' => [
        ['due_date' => null], ['start_time' => '09:30'], ['due_date' => '2026-10-23', 'start_time' => '09:30'],
    ],
    'past time on undated task' => [
        ['due_date' => null], ['start_time' => '07:00'], ['due_date' => '2026-10-24', 'start_time' => '07:00'],
    ],
    'explicit end overrides duration' => [
        ['due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '10:00'],
        ['start_time' => '09:30', 'end_time' => '11:00'], ['start_time' => '09:30', 'end_time' => '11:00'],
    ],
]);

it('rejects a task that was supplied for a different uncertain item', function () {
    config(['note_llm.candidate_limit' => 1]);
    $tasks = [
        ['id' => (string) Str::uuid(), 'title' => 'Call mum'],
        ['id' => (string) Str::uuid(), 'title' => 'Gym'],
    ];
    $text = 'delete mum phone; delete gym missing';
    $rules = app(NoteEngine::class)->build($text, $this->context, $tasks);
    expect(array_keys($rules->lowConfidence))->toBe(['i1', 'i2']);
    $proposal = ['action' => 'delete', 'task_id' => $tasks[1]['id'], 'title' => null,
        'due_date' => null, 'start_time' => null, 'end_time' => null, 'priority' => null,
        'project' => null, 'repeat' => 'never', 'repeat_rule' => null, 'copies' => 1, 'reminder' => 'none'];
    $response = recordedNoteResponse();
    $response['choices'][0]['message']['content'] = json_encode(['items' => [
        ['ref' => 'i1', ...$proposal], ['ref' => 'i2', ...$proposal],
    ]]);
    Http::fake(['openrouter.ai/*' => Http::response($response)]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, $tasks, 1);

    expect(array_column($result->plan['delete'], 'ref'))->toBe(['i2'])
        ->and(array_column($result->plan['skipped'], 'ref'))->toBe(['i1'])
        ->and($result->status)->toBe(PlanStatus::Confirm);
});

it('accepts a calendar recurrence from the model and starts on its first matching date', function () {
    $text = 'toi can mua sua';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'repeat' => 'weekly', 'repeat_rule' => 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR', 'due_date' => '2026-10-24',
    ]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_llm')
        ->and($result->plan['create'][0]['repeat_rule'])->toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR')
        ->and($result->plan['create'][0]['due_date'])->toBe('2026-10-26');
    Http::assertSent(function (Request $request): bool {
        $item = $request['response_format']['json_schema']['schema']['properties']['items']['items'];
        expect($item['required'])->toContain('repeat_rule', 'copies');
        expect($request['messages'][0]['content'])->toContain('repeat_rule', 'copies');

        return true;
    });
});

it('replaces all copies of one uncertain item without leaving stale rules entries', function () {
    $text = 'toi can mua sua 3 times every day; call dad';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    expect(array_column($rules->plan['create'], 'ref'))->toBe(['i1', 'i1-2', 'i1-3', 'i2']);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'copies' => 3, 'repeat' => 'daily', 'repeat_rule' => 'FREQ=DAILY', 'due_date' => '2026-10-24',
    ]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_llm')
        ->and(array_column($result->plan['create'], 'ref'))->toBe(['i1', 'i1-2', 'i1-3', 'i2'])
        ->and(array_column($result->plan['create'], 'title'))->toBe(['Mua sữa (1/3)', 'Mua sữa (2/3)', 'Mua sữa (3/3)', 'Call dad']);
});

it('keeps the rules item when model copies would exceed the note item limit', function () {
    config(['notes.max_items' => 2]);
    $text = 'toi can mua sua; call dad';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['copies' => 2]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
});

it('keeps the original request when the model gives one time for several copies', function () {
    $text = 'toi can mua sua';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'copies' => 3, 'due_date' => '2026-10-24', 'start_time' => '09:00',
    ]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
});

it('rejects copy counts attached to a model command', function () {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum'];
    $text = 'delete mum phone';
    $rules = app(NoteEngine::class)->build($text, $this->context, [$task]);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'action' => 'delete', 'task_id' => $task['id'], 'copies' => 2,
    ]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task], 1);

    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
});

it('rejects an invalid calendar proposal while accepting another valid item', function (string $rule) {
    $text = 'toi can mua sua; toi can mua banh';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([
        ['repeat' => 'weekly', 'repeat_rule' => $rule, 'due_date' => '2026-10-24'],
        ['ref' => 'i2', 'title' => 'Mua bánh'],
    ]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->engine->value)->toBe('rules_llm')
        ->and(array_column($result->plan['create'], 'title'))->toBe(['Mua bánh'])
        ->and($result->plan['skipped'][0]['text'])->toBe('toi can mua sua')
        ->and($result->itemOutcomes['i1']['status'])->toBe('rejected')
        ->and($result->itemOutcomes['i2']['status'])->toBe('accepted');
})->with(['frequency mismatch' => 'FREQ=DAILY', 'unknown rule part' => 'FREQ=WEEKLY;DTSTART=20261024', 'exhausted series' => 'FREQ=WEEKLY;UNTIL=20000101']);

it('routes only the unresolved command target and preserves its known sibling', function (string $text, string $ref) {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum'];
    $rules = app(NoteEngine::class)->build($text, $this->context, [$task]);
    expect($rules->lowConfidence)->toBe([$ref => 'delete absent'])
        ->and($rules->plan['delete'])->toHaveCount(1)
        ->and($rules->plan['skipped'])->toHaveCount(1);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['ref' => $ref, 'action' => 'skip']]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task], 1);

    expect($result->plan['delete'])->toBe($rules->plan['delete'])
        ->and($result->engine->value)->toBe('rules_llm')
        ->and($result->status)->toBe(PlanStatus::Confirm);
    Http::assertSent(fn (Request $request): bool => str_contains($request['messages'][1]['content'], 'delete absent')
        && ! str_contains($request['messages'][1]['content'], 'delete mum'));
})->with([['delete mum and absent', 'i1-2'], ['delete absent and mum', 'i1']]);

it('lets the model interpret unrecognized commands against relevant candidate IDs', function (string $text, string $action) {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum', 'due_date' => '2026-10-26'];
    $other = ['id' => (string) Str::uuid(), 'title' => 'Buy eggs'];
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'action' => $action, 'task_id' => $task['id'], 'due_date' => '2026-10-28',
    ]]))]);
    $rules = app(NoteEngine::class)->build($text, $this->context, [$task, $other]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task, $other], 1);

    expect($result->engine->value)->toBe('rules_llm')->and($result->plan['create'])->toBe([])
        ->and($result->plan[$action === 'delete' ? 'delete' : 'update'][0]['task_id'])->toBe($task['id']);
    Http::assertSent(function (Request $request) use ($text, $task, $other): bool {
        $input = json_decode($request['messages'][1]['content'], true);
        expect($input['items'][0]['text'])->toBe($text)
            ->and(array_column($input['items'][0]['candidates'], 'id'))->toBe([$task['id']]);

        return ! str_contains($request['messages'][1]['content'], $other['id']);
    });
})->with([['xoa call mum', 'delete'], ['doi call mum sang thu tu', 'reschedule']]);

it('preserves an unresolved sibling omitted from the model response', function () {
    $text = 'delete absent and unknown';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    expect(array_keys($rules->lowConfidence))->toBe(['i1', 'i1-2']);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['ref' => 'i1', 'action' => 'skip']]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect(array_column($result->plan['skipped'], 'ref'))->toBe(['i1', 'i1-2'])
        ->and($result->plan['skipped'][1])->toBe($rules->plan['skipped'][1]);
});

it('rejects a create proposal that also identifies an existing task', function () {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum'];
    $text = 'doi call mum sang thu tu';
    $rules = app(NoteEngine::class)->build($text, $this->context, [$task]);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'action' => 'create', 'task_id' => $task['id'], 'title' => 'Call mum',
    ]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task], 1);

    expect($result->engine->value)->toBe('rules_fallback')->and(array_column($result->plan['create'], 'ref'))->not->toContain('i1')->and(array_column($result->plan['skipped'], 'text'))->toContain($rules->lowConfidence['i1']);
});

it('retrieves accented candidate titles for unaccented uncertain input without rewriting them', function () {
    $task = ['id' => (string) Str::uuid(), 'title' => 'Gọi mẹ'];
    $text = 'xoa goi me';
    $rules = app(NoteEngine::class)->build($text, $this->context, [$task]);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['action' => 'delete', 'task_id' => $task['id']]]))]);

    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [$task], 1);

    expect($result->plan['delete'][0]['task_id'])->toBe($task['id'])->and($result->status)->toBe(PlanStatus::Confirm);
    Http::assertSent(function (Request $request) use ($task): bool {
        $input = json_decode($request['messages'][1]['content'], true);

        return $input['items'][0]['candidates'] === [$task];
    });
});

it('keeps unresolved references in followup even if the model invents a specific task', function (string $mode) {
    $text = 'do that thing whenever';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    if ($mode === 'timeout') {
        Http::fake(fn () => throw new ConnectionException('Timeout'));
    } else {
        Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['action' => 'create', 'title' => 'Buy milk']]))]);
    }
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->status)->toBe(PlanStatus::Followup)->and($result->plan['create'])->toBe([])
        ->and($result->plan['skipped'][0])->toMatchArray(['text' => $text, 'reason' => 'unclear']);
})->with(['invented-task', 'timeout']);

it('accepts an explicit unclear proposal for unsupported input and holds the whole note', function () {
    $text = 'blargh 9h; call dad tomorrow';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['action' => 'unclear', 'title' => null]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);

    expect($result->status)->toBe(PlanStatus::Followup)->and($result->plan['create'])->toHaveCount(1)
        ->and($result->plan['skipped'][0]['reason'])->toBe('unclear');
});

it('holds missing and rejected items separately while keeping an accepted proposal', function () {
    $text = 'toi can mua sua; toi can mua banh; toi can di bo';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([
        ['ref' => 'i1', 'title' => 'Mua sữa'],
        ['ref' => 'i2', 'title' => null],
    ]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect(array_column($result->plan['create'], 'title'))->toBe(['Mua sữa'])
        ->and(array_column($result->plan['skipped'], 'text'))->toBe(['toi can mua banh', 'toi can di bo'])
        ->and($result->status)->toBe(PlanStatus::Followup)
        ->and($result->itemOutcomes['i1']['status'])->toBe('accepted')
        ->and($result->itemOutcomes['i2']['reason'])->toBe('invalid_proposal')
        ->and($result->itemOutcomes['i3']['reason'])->toBe('no_proposal');
});

it('supplies a deterministic first date for an understood recurrence', function (string $repeat, ?string $rule, ?string $time, string $date) {
    $text = 'di bo hang ngay';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'title' => 'Đi bộ', 'due_date' => null, 'repeat' => $repeat, 'repeat_rule' => $rule, 'start_time' => $time,
    ]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect($result->plan['create'][0])->toMatchArray(['due_date' => $date, 'repeat' => $repeat, 'start_time' => $time])
        ->and($result->itemOutcomes['i1']['status'])->toBe('accepted');
})->with([
    ['daily', null, null, '2026-10-23'],
    ['daily', 'FREQ=DAILY', null, '2026-10-23'],
    ['weekly', 'FREQ=WEEKLY;BYDAY=MO,WE', '09:00', '2026-10-26'],
    ['daily', 'FREQ=DAILY', '07:00', '2026-10-24'],
]);

it('preserves a reliably read clock while letting the model clean the title', function () {
    $text = 'Tao muốn đánh cầu lông lúc 2h';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'title' => 'Đánh cầu lông', 'start_time' => '14:00', 'due_date' => '2026-10-23',
    ]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect($result->plan['create'][0]['start_time'])->toBe('02:00')
        ->and($result->itemOutcomes['i1']['field_sources']['start_time'])->toBe('rules');
});

it('preserves tomorrow and the clock even when a model proposes today or omits them', function (?string $modelDate, ?string $modelTime) {
    $context = new NoteContext(new DateTimeImmutable('2026-11-03T10:00:00+07:00'), 'Asia/Ho_Chi_Minh');
    $text = 'Mai tao phải đi chơi 7 giờ';
    $rules = app(NoteEngine::class)->build($text, $context);
    expect($rules->lowConfidence)->toBe(['i1' => $text]);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'title' => 'Đi chơi', 'due_date' => $modelDate, 'start_time' => $modelTime,
        'priority' => 'medium', 'reminder' => 'none',
    ]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $context, [], 1);
    expect($result->plan['create'][0])->toMatchArray([
        'title' => 'Đi chơi', 'due_date' => '2026-11-04', 'start_time' => '07:00',
        'end_time' => null, 'priority' => 'low', 'reminder' => '15m',
    ])->and($result->itemOutcomes['i1']['source'])->toBe('mixed')
        ->and($result->itemOutcomes['i1']['field_sources'])->toMatchArray([
            'due_date' => 'rules', 'start_time' => 'rules', 'title' => 'llm', 'reminder' => 'server',
        ]);
    Http::assertSent(function (Request $request): bool {
        $input = json_decode($request['messages'][1]['content'], true);

        return $input['items'][0]['known_fields']['due_date'] === '2026-11-04'
            && $input['items'][0]['known_fields']['start_time'] === '07:00';
    });
})->with([['2026-11-03', '07:00'], [null, null], ['2026-11-03', '09:00']]);

it('keeps known date and clock on a reschedule without replacing task identity', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-11-03T10:00:00+07:00'), 'Asia/Ho_Chi_Minh');
    $text = 'Bạn chuyển Call mum sang ngày mai lúc 9 giờ';
    $task = ['id' => (string) Str::uuid(), 'title' => 'Call mum', 'due_date' => '2026-11-05'];
    $rules = app(NoteEngine::class)->build($text, $context, [$task]);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'action' => 'reschedule', 'task_id' => $task['id'], 'due_date' => '2026-11-03', 'start_time' => '10:00',
    ]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $context, [$task], 1);
    expect($result->plan['update'][0])->toMatchArray(['task_id' => $task['id'], 'due_date' => '2026-11-04', 'start_time' => '09:00'])
        ->and($result->plan['create'])->toBe([]);
});

it('allows the model to interpret an unreadable time while preserving a clear date', function () {
    $text = 'could you call mum tomorrow at 3pmish';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'title' => 'Call mum', 'due_date' => null, 'start_time' => '15:00',
    ]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect($result->plan['create'][0])->toMatchArray(['due_date' => '2026-10-24', 'start_time' => '15:00'])
        ->and($result->itemOutcomes['i1']['field_sources']['due_date'])->toBe('rules')
        ->and($result->itemOutcomes['i1']['field_sources']['start_time'])->toBe('llm');
});

it('preserves both endpoints of a reliable range when only the wording needs interpretation', function () {
    $text = 'Bạn sắp xếp họp ngày mai từ 9h đến 10h';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([[
        'title' => 'Họp', 'due_date' => '2026-10-23', 'start_time' => '11:00', 'end_time' => '12:00',
    ]]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect($result->plan['create'][0])->toMatchArray(['due_date' => '2026-10-24', 'start_time' => '09:00', 'end_time' => '10:00'])
        ->and($result->itemOutcomes['i1']['field_sources']['end_time'])->toBe('rules');
});

it('routes a possible observation through the model instead of treating frequency as task intent', function () {
    $text = 'daily walk could benefits health';
    $rules = app(NoteEngine::class)->build($text, $this->context);
    expect($rules->lowConfidence)->toBe(['i1' => $text]);
    Http::fake(['openrouter.ai/*' => Http::response(modelNoteResponse([['action' => 'skip']]))]);
    $result = app(OpenRouterFallback::class)->improve($rules, $text, $this->context, [], 1);
    expect($result->plan['create'])->toBe([])->and($result->plan['skipped'][0]['reason'])->toBe('skip')
        ->and($result->itemOutcomes['i1']['status'])->toBe('skipped');
});
