<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

function notePayload(string $text = 'call mum tomorrow'): array
{
    return ['client_id' => (string) Str::uuid(), 'text' => $text, 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];
}

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    $this->noteUser = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
});

it('creates assistant tasks and returns stored results on client-id replay (T-NU-60, T-NU-72, SEC-13)', function () {
    $payload = notePayload('call mum tomorrow; read report');
    $first = $this->actingAs($this->noteUser)->postJson('/api/v1/notes', $payload)->assertCreated()->assertJsonPath('note.status', 'done');
    expect(Task::count())->toBe(2);
    $task = Task::firstOrFail();
    expect($task->created_by)->toBe('assistant')->and($task->source_note_id)->toBe($first->json('note.id'));
    $replay = $this->postJson('/api/v1/notes', ['client_id' => $payload['client_id'], 'text' => null])->assertOk();
    expect($replay->json())->toBe($first->json())->and(Note::count())->toBe(1)->and(Task::count())->toBe(2);
    expect(Note::firstOrFail()->applied)->toHaveCount(2);
});

it('validates the response against the shared API schema (T-NU-80)', function () {
    $response = $this->actingAs($this->noteUser)->postJson('/api/v1/notes', notePayload())->assertCreated();
    $validator = new Validator;
    $validator->resolver()->registerPrefix('https://agendal.app/schemas/', base_path('../docs/07-architecture/contracts/schemas/'));
    $result = $validator->validate(json_decode($response->getContent()), 'https://agendal.app/schemas/note-result.schema.json');
    expect($result->isValid())->toBeTrue($result->isValid() ? '' : json_encode((new ErrorFormatter)->format($result->error())));
});

it('records before values without clearing unchanged task fields', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->noteUser->id, 'title' => 'Email group', 'due_date' => '2026-10-23', 'start_time' => '09:00', 'end_time' => '10:00'])->save();
    $this->actingAs($this->noteUser)->postJson('/api/v1/notes', notePayload('done email group'))->assertCreated();
    expect($task->fresh()->done)->toBeTrue()->and($task->fresh()->due_date)->toBe('2026-10-23');
    $log = Note::firstOrFail()->applied;
    expect($log[0]['before']['done'])->toBeFalse()->and($log[0]['before']['start_time'])->toBe('09:00:00');
});

it('persists confirm plans without changing tasks (T-NU-42)', function (string $text) {
    $task = new Task;
    $task->forceFill(['user_id' => $this->noteUser->id, 'title' => 'Old reading list'])->save();
    $this->actingAs($this->noteUser)->postJson('/api/v1/notes', notePayload($text))->assertCreated()->assertJsonPath('note.status', 'confirm')->assertJsonCount(0, 'changes');
    expect(Task::count())->toBe(1)->and($task->fresh())->not->toBeNull();
    expect(Note::firstOrFail()->applied)->toBe([]);
})->with(['delete old reading list', 'buy milk; buy eggs; buy bread; buy rice; buy tea; buy soap']);

it('uses the written time for offline notes (T-NU-126)', function () {
    $payload = array_replace(notePayload('read tonight'), ['written_at' => '2026-10-22T19:00:00+07:00']);
    $this->actingAs($this->noteUser)->postJson('/api/v1/notes', $payload)->assertCreated();
    expect(Task::firstOrFail()->due_date)->toBe('2026-10-22')->and(Task::firstOrFail()->start_time)->toBe('20:00:00');
});

it('rolls back the note and all task writes on apply failure (T-NU-73)', function () {
    Event::listen('eloquent.created: '.Task::class, function (Task $task): void {
        if ($task->title === 'Call dad') {
            throw new RuntimeException('Injected apply failure');
        }
    });
    $this->actingAs($this->noteUser)->postJson('/api/v1/notes', notePayload('call mum; call dad'))->assertStatus(500);
    expect(Note::count())->toBe(0)->and(Task::count())->toBe(0);
});

it('never commands another user’s tasks (SEC-12)', function () {
    $other = User::factory()->create();
    $task = new Task;
    $task->forceFill(['user_id' => $other->id, 'title' => 'Email group'])->save();
    $this->actingAs($this->noteUser)->postJson('/api/v1/notes', notePayload('done email group'))->assertCreated()->assertJsonCount(0, 'changes');
    expect(Task::withoutGlobalScopes()->findOrFail($task->id)->done)->toBeFalse();
});

it('requires a session (T-NU-81)', function () {
    $this->postJson('/api/v1/notes', notePayload())->assertUnauthorized();
});

it('rejects invalid notes without storing anything (T-NU-83)', function (array $overrides) {
    $this->actingAs($this->noteUser)->postJson('/api/v1/notes', array_replace(notePayload(), $overrides))->assertUnprocessable();
    expect(Note::count())->toBe(0)->and(Task::count())->toBe(0);
})->with([
    [['text' => ' . ; ']], [['text' => str_repeat('a', 5001)]],
    [['text' => implode(';', array_fill(0, 31, 'call mum'))]],
    [['client_id' => 'not-a-uuid']], [['written_at' => '2026-10-23T08:12:00']],
]);

it('limits note submission and includes Retry-After (T-NU-84)', function () {
    $this->actingAs($this->noteUser);
    for ($i = 0; $i < 30; $i++) {
        $this->postJson('/api/v1/notes', notePayload('ok'))->assertCreated();
    }
    $this->postJson('/api/v1/notes', notePayload())->assertStatus(429)->assertHeader('Retry-After');
});
