<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

function confirmNote(string $text): array
{
    return ['client_id' => (string) Str::uuid(), 'text' => $text, 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];
}

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    $this->user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $this->actingAs($this->user);
});

it('asks before applying a single change and previews it (BR-01, T-RV-40)', function () {
    $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->assertCreated()
        ->assertJsonPath('note.status', 'confirm')
        ->assertJsonPath('changes.0.kind', 'created')
        ->assertJsonPath('changes.0.task.title', 'Call mum')
        ->assertJsonPath('changes.0.task.due_date', '2026-10-24');

    expect(Task::count())->toBe(0)->and(Note::firstOrFail()->applied)->toBe([]);
});

it('applies a confirm plan once (NU-5, WF-02)', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow, buy milk'))->json('note.id');

    $result = $this->postJson("/api/v1/notes/{$id}/apply")->assertOk()->assertJsonPath('note.status', 'done')->assertJsonCount(2, 'changes');

    expect(Task::query()->pluck('title')->sort()->values()->all())->toBe(['Buy milk', 'Call mum'])
        ->and(Task::find($result->json('changes.0.task.id')))->not->toBeNull()
        ->and(Note::firstOrFail()->applied)->toHaveCount(2);
    $this->postJson("/api/v1/notes/{$id}/apply")->assertStatus(409)->assertJsonPath('error.code', 'note.wrong_status');
    expect(Task::count())->toBe(2);
});

it('re-validates at apply: a task deleted since is skipped (NU-E38)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Old reading list'])->save();
    $id = $this->postJson('/api/v1/notes', confirmNote('delete old reading list'))->assertJsonPath('note.status', 'confirm')->json('note.id');
    $task->delete();

    $this->postJson("/api/v1/notes/{$id}/apply")->assertOk()->assertJsonCount(0, 'changes')->assertJsonPath('skipped.0.reason', 'not_found');
});

it('keeps the note and changes nothing on Edit note (WF-02)', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->json('note.id');

    $this->postJson("/api/v1/notes/{$id}/cancel")->assertOk()->assertJsonPath('note.status', 'kept');

    expect(Task::count())->toBe(0);
    $this->postJson("/api/v1/notes/{$id}/apply")->assertStatus(409);
    $this->postJson("/api/v1/notes/{$id}/cancel")->assertStatus(409);
});

it('shows a note to its owner only (RV §7)', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->json('note.id');
    $this->getJson("/api/v1/notes/{$id}")->assertOk()->assertJsonPath('note.status', 'confirm')->assertJsonCount(1, 'changes');

    $this->actingAs(User::factory()->create());
    $this->getJson("/api/v1/notes/{$id}")->assertNotFound();
    $this->postJson("/api/v1/notes/{$id}/apply")->assertNotFound();
    $this->postJson("/api/v1/notes/{$id}/cancel")->assertNotFound();
});

it('applies the edits made on Check this first, by entry ref', function () {
    $note = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->assertJsonPath('changes.0.ref', 'i1');

    $this->postJson("/api/v1/notes/{$note->json('note.id')}/apply", ['edits' => ['i1' => ['title' => 'Call mum back', 'due_date' => '2026-10-30', 'priority' => 'high']]])
        ->assertOk()->assertJsonPath('changes.0.task.title', 'Call mum back');

    $task = Task::firstOrFail();
    expect([$task->title, substr((string) $task->due_date, 0, 10), $task->priority])->toBe(['Call mum back', '2026-10-30', 'high']);
});

it('keeps a moved task where the user put it instead of planning the move again', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Gym', 'due_date' => '2026-10-24'])->save();
    $note = $this->postJson('/api/v1/notes', confirmNote('move gym to monday'))->assertJsonPath('note.status', 'confirm');
    $ref = $note->json('changes.0.ref');

    $this->postJson("/api/v1/notes/{$note->json('note.id')}/apply", ['edits' => [$ref => ['due_date' => '2026-10-28']]])->assertOk();

    expect(substr((string) $task->fresh()->due_date, 0, 10))->toBe('2026-10-28');
});

it('refuses edits to fields a task patch may not set', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->json('note.id');

    $this->postJson("/api/v1/notes/{$id}/apply", ['edits' => ['i1' => ['user_id' => 99]]])->assertStatus(422);
    $this->postJson("/api/v1/notes/{$id}/apply", ['edits' => ['i1' => 'x']])->assertStatus(422);

    expect(Task::count())->toBe(0)->and(Note::firstOrFail()->status)->toBe('confirm');
});
