<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    config(['note_llm.enabled' => false, 'notes.engine_budget_ms' => 60000]);
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
    $this->payload = ['client_id' => (string) Str::uuid(), 'text' => 'do that thing whenever',
        'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];
});

it('persists unclear items without creating tasks even without a model or rules budget', function () {
    config(['notes.engine_budget_ms' => 0]);
    $result = $this->postJson('/api/v1/notes', $this->payload)->assertCreated()
        ->assertJsonPath('note.status', 'followup')->assertJsonPath('skipped.0.reason', 'unclear')
        ->assertJsonCount(0, 'changes');

    expect(Task::count())->toBe(0);
    $this->getJson('/api/v1/notes/'.$result->json('note.id'))->assertOk()->assertJson($result->json());
});

it('holds known creates and deletes while asking about unclear text', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Call mum'])->save();
    $payload = [...$this->payload, 'text' => 'buy milk; delete call mum; làm cái đó lúc nào cũng được'];
    $this->postJson('/api/v1/notes', $payload)->assertCreated()->assertJsonPath('note.status', 'followup')->assertJsonCount(0, 'changes');

    expect(Task::count())->toBe(1)->and($task->fresh())->not->toBeNull()->and(Note::firstOrFail()->applied)->toBe([]);
});

it('clarifies the same note and replays a completed answer without duplicate tasks', function () {
    $first = $this->postJson('/api/v1/notes', [...$this->payload, 'text' => 'buy milk; do that thing whenever'])->assertCreated();
    $id = $first->json('note.id');
    $answer = [...$this->payload, 'text' => 'buy milk; call dad tomorrow'];
    $result = $this->postJson('/api/v1/notes/'.$id.'/clarify', $answer)->assertOk()
        ->assertJsonPath('note.id', $id)->assertJsonPath('note.status', 'done')->assertJsonCount(2, 'changes');
    expect(Note::count())->toBe(1)->and(Task::count())->toBe(2);
    $this->postJson('/api/v1/notes/'.$id.'/clarify', $answer)->assertOk()->assertJson($result->json());
    expect(Task::count())->toBe(2);
    $this->getJson('/api/v1/notes/'.$id)->assertOk()->assertJson($result->json());
});

it('keeps asking when the answer still lacks a task object', function () {
    $first = $this->postJson('/api/v1/notes', $this->payload)->assertCreated();
    $this->postJson('/api/v1/notes/'.$first->json('note.id').'/clarify', [...$this->payload, 'text' => 'làm cái đó'])
        ->assertOk()->assertJsonPath('note.status', 'followup')->assertJsonPath('skipped.0.reason', 'unclear');
    expect(Task::count())->toBe(0)->and(Note::count())->toBe(1);
});

it('cannot read or clarify another users note', function () {
    $first = $this->postJson('/api/v1/notes', $this->payload)->assertCreated();
    $this->actingAs(User::factory()->create());
    $id = $first->json('note.id');
    $this->getJson('/api/v1/notes/'.$id)->assertNotFound();
    $this->postJson('/api/v1/notes/'.$id.'/clarify', $this->payload)->assertNotFound();
});

it('requires CSRF protection when answering a followup from the browser', function () {
    $first = $this->postJson('/api/v1/notes', $this->payload)->assertCreated();
    $this->app['env'] = 'local';
    $this->withHeader('Referer', 'http://localhost:3000/')->postJson('/api/v1/notes/'.$first->json('note.id').'/clarify',
        [...$this->payload, 'text' => 'buy milk'])->assertStatus(419);
    expect(Task::count())->toBe(0)->and(Note::firstOrFail()->status)->toBe('followup');
});

it('never applies provisional low-confidence writes while fallback is disabled', function () {
    $result = $this->postJson('/api/v1/notes', [...$this->payload, 'text' => 'buy milk; doi call mum sang thu tu'])
        ->assertCreated()->assertJsonPath('note.status', 'followup')->assertJsonCount(0, 'changes')
        ->assertJsonPath('processing.0.reason', 'disabled');
    expect(Task::count())->toBe(0)->and(Note::firstOrFail()->applied)->toBe([]);
    $this->getJson('/api/v1/notes/'.$result->json('note.id'))->assertOk()->assertJson($result->json());
});

it('persists trusted schedule fields and defaults while accepting a cleaned model title', function (string $provider, string $url) {
    app()->instance(ClockInterface::class, new FrozenClock('2026-11-03T10:00:00+07:00'));
    config(['note_llm.enabled' => true, 'note_llm.key' => 'test-only', 'note_llm.model' => 'test/model', 'note_llm.prompt_version' => 'note-plan-v6']);
    config(['note_llm.provider' => $provider, 'note_llm.url' => $url]);
    $response = json_decode(file_get_contents(__DIR__.'/../Fixtures/note-llm-response.json'), true, flags: JSON_THROW_ON_ERROR);
    $template = json_decode($response['choices'][0]['message']['content'], true, flags: JSON_THROW_ON_ERROR)['items'][0];
    $response['choices'][0]['message']['content'] = json_encode(['items' => [[...$template,
        'title' => 'Đi chơi', 'due_date' => '2026-11-03', 'start_time' => '07:00', 'priority' => 'medium', 'reminder' => 'none',
    ]]]);
    Http::preventStrayRequests();
    Http::fake([$url => Http::response($response)]);
    $this->postJson('/api/v1/notes', [...$this->payload, 'text' => 'Mai tao phải đi chơi 7 giờ', 'written_at' => '2026-11-03T10:00:00+07:00'])
        ->assertCreated()->assertJsonPath('note.status', 'done')
        ->assertJsonPath('changes.0.task.title', 'Đi chơi')->assertJsonPath('changes.0.task.due_date', '2026-11-04')
        ->assertJsonPath('changes.0.task.start_time', '07:00')->assertJsonPath('changes.0.task.reminder', '15m')
        ->assertJsonPath('changes.0.task.priority', 'low')
        ->assertJsonPath('processing.0.source', 'mixed')->assertJsonPath('processing.0.field_sources.due_date', 'rules');
    expect(Task::count())->toBe(1);
    Http::assertSent(function (Request $request) use ($provider): bool {
        if ($provider === 'nvidia') {
            expect($request->data())->not->toHaveKeys(['provider', 'reasoning'])
                ->and($request['chat_template_kwargs'])->toBe(['enable_thinking' => false]);
        } else {
            expect($request['provider']['data_collection'])->toBe('deny');
        }

        return true;
    });
})->with([
    ['openrouter', 'https://openrouter.ai/api/v1/chat/completions'],
    ['nvidia', 'https://integrate.api.nvidia.com/v1/chat/completions'],
]);

it('rejects a different answer after the note has already applied its changes', function () {
    $first = $this->postJson('/api/v1/notes', [...$this->payload, 'text' => 'buy milk'])->assertCreated();
    $this->postJson('/api/v1/notes/'.$first->json('note.id').'/clarify', [...$this->payload, 'text' => 'buy eggs'])->assertStatus(409);
    expect(Task::count())->toBe(1)->and(Note::firstOrFail()->text)->toBe('buy milk');
});
