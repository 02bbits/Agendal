<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

it('omits a proposed creation without writing it and undoes only the applied task', function () {
    $note = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow, buy milk'))->assertCreated();
    $id = $note->json('note.id');
    $ref = $note->json('changes.0.ref');
    $this->postJson("/api/v1/notes/{$id}/apply", ['exclude' => [$ref]])->assertOk()->assertJsonCount(1, 'changes');
    expect(Task::count())->toBe(1)->and(Note::findOrFail($id)->applied)->toHaveCount(1);
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk();
    expect(Task::count())->toBe(0);
    $this->postJson("/api/v1/notes/{$id}/redo")->assertOk();
    expect(Task::count())->toBe(1);
});

it('omits a planned deletion without deleting the existing task', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Old reading list'])->save();
    $note = $this->postJson('/api/v1/notes', confirmNote('delete old reading list, buy milk'))->assertCreated();
    $ref = collect($note->json('changes'))->firstWhere('kind', 'deleted')['ref'];
    $this->postJson('/api/v1/notes/'.$note->json('note.id').'/apply', ['exclude' => [$ref]])->assertOk()->assertJsonCount(1, 'changes');
    expect($task->fresh())->not->toBeNull()->and(Task::count())->toBe(2);
});

it('refuses unknown duplicate and all-omitted refs without changing the plan', function () {
    $note = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->assertCreated();
    $id = $note->json('note.id');
    $ref = $note->json('changes.0.ref');
    foreach ([['unknown'], [$ref, $ref], [$ref]] as $refs) {
        $this->postJson("/api/v1/notes/{$id}/apply", ['exclude' => $refs])->assertUnprocessable();
    }
    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('confirm');
});

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

it('shows a note to its owner only (RV §7)', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->json('note.id');
    $this->getJson("/api/v1/notes/{$id}")->assertOk()->assertJsonPath('note.status', 'confirm')->assertJsonCount(1, 'changes');

    $this->actingAs(User::factory()->create());
    $this->getJson("/api/v1/notes/{$id}")->assertNotFound();
    $this->postJson("/api/v1/notes/{$id}/apply")->assertNotFound();
});

it('applies the edits made on Check this first, by entry ref', function () {
    $note = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->assertJsonPath('changes.0.ref', 'i1');

    $this->postJson("/api/v1/notes/{$note->json('note.id')}/apply", ['edits' => ['i1' => ['title' => 'Call mum back', 'due_date' => '2026-10-30', 'priority' => 'high']]])
        ->assertOk()->assertJsonPath('changes.0.task.title', 'Call mum back');

    $task = Task::firstOrFail();
    expect([$task->title, substr((string) $task->due_date, 0, 10), $task->priority])->toBe(['Call mum back', '2026-10-30', 'high']);
});

it('applies schedule edits a task allows: start date, due time, and a due date that leaves the start', function () {
    $note = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow at 9am'))->assertJsonPath('changes.0.task.start_date', '2026-10-24');
    $id = $note->json('note.id');

    $this->postJson("/api/v1/notes/{$id}/apply", ['edits' => ['i1' => ['start_date' => '2026-10-24', 'due_date' => '2026-10-30', 'due_time' => '18:00']]])
        ->assertOk()->assertJsonCount(1, 'changes');

    $task = Task::firstOrFail();
    expect([substr((string) $task->start_date, 0, 10), substr((string) $task->due_date, 0, 10), substr((string) $task->due_time, 0, 5)])
        ->toBe(['2026-10-24', '2026-10-30', '18:00']);
});

it('keeps the start Check this first showed when only the due date is edited', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow at 9am'))->json('note.id');

    $this->postJson("/api/v1/notes/{$id}/apply", ['edits' => ['i1' => ['due_date' => '2026-10-30']]])->assertOk();

    $task = Task::firstOrFail();
    expect([substr((string) $task->start_date, 0, 10), substr((string) $task->due_date, 0, 10)])->toBe(['2026-10-24', '2026-10-30']);
});

it('refuses an edit the plan cannot take instead of dropping its task', function () {
    $id = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow at 9am'))->json('note.id');

    $this->postJson("/api/v1/notes/{$id}/apply", ['edits' => ['i1' => ['start_date' => '2026-10-31']]])->assertUnprocessable();

    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('confirm');
});

it('refuses edits made on a plan the note no longer has (Edit note elsewhere)', function () {
    $note = $this->postJson('/api/v1/notes', confirmNote('call mum tomorrow'))->assertCreated();
    $id = $note->json('note.id');
    $reviewed = $note->json('note.processed_at');
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:20:00+07:00'));
    $this->putJson("/api/v1/notes/{$id}", ['text' => 'buy milk friday', 'timezone' => 'Asia/Ho_Chi_Minh'])->assertOk()->assertJsonPath('note.status', 'confirm');

    $this->postJson("/api/v1/notes/{$id}/apply", ['edits' => ['i1' => ['title' => 'Stale title']], 'processed_at' => $reviewed])
        ->assertStatus(409)->assertJsonPath('error.code', 'note.plan_changed');
    expect(Task::count())->toBe(0);

    $current = $this->getJson("/api/v1/notes/{$id}")->json('note.processed_at');
    $this->postJson("/api/v1/notes/{$id}/apply", ['processed_at' => $current])->assertOk()->assertJsonPath('changes.0.task.title', 'Buy milk');
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

it('keeps the written date through confirmation of an offline note (T-NU-126)', function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-24T08:12:00+07:00'));
    $payload = confirmNote('read tonight');
    $payload['written_at'] = '2026-10-23T19:00:00+07:00';
    $result = $this->postJson('/api/v1/notes', $payload)->assertCreated()
        ->assertJsonPath('note.status', 'confirm')->assertJsonPath('changes.0.task.due_date', '2026-10-23');

    expect(Task::count())->toBe(0);
    $this->postJson('/api/v1/notes/'.$result->json('note.id').'/apply')->assertOk();
    expect(Task::firstOrFail()->due_date)->toBe('2026-10-23')
        ->and(Task::firstOrFail()->start_time)->toBe('20:00:00');
});

it('replans a relative move from current values through Apply changes (T-NU-135, T-NU-138)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Lunch meeting', 'start_date' => '2026-10-29', 'due_date' => '2026-10-29', 'start_time' => '09:00', 'due_time' => '10:00'])->save();
    $result = $this->postJson('/api/v1/notes', confirmNote('push lunch meeting back 1 hour'))->assertCreated()
        ->assertJsonPath('note.status', 'confirm');
    expect($task->fresh()->start_time)->toBe('09:00:00');

    $task->forceFill(['start_time' => '14:00', 'due_time' => '15:00'])->save();
    $this->postJson('/api/v1/notes/'.$result->json('note.id').'/apply')->assertOk()
        ->assertJsonPath('changes.0.task.id', $task->id);
    expect([$task->fresh()->start_time, $task->fresh()->due_time])->toBe(['15:00:00', '16:00:00'])
        ->and(Note::findOrFail($result->json('note.id'))->applied[0]['before']['start_time'])->toBe('14:00:00');
});

it('skips a task completed after its move was previewed (T-NU-138)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Lunch meeting', 'due_date' => '2026-10-23'])->save();
    $result = $this->postJson('/api/v1/notes', confirmNote('move lunch meeting to sunday'))->assertCreated()
        ->assertJsonPath('note.status', 'confirm');
    $task->forceFill(['done' => true])->save();

    $this->postJson('/api/v1/notes/'.$result->json('note.id').'/apply')->assertOk()
        ->assertJsonCount(0, 'changes')->assertJsonPath('skipped.0.reason', 'not_found');
    expect($task->fresh()->due_date)->toBe('2026-10-23')->and($task->fresh()->done)->toBeTrue();
});

it('moves only this occurrence then completes it once after confirmation (T-NU-136)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Call mum', 'due_date' => '2026-10-23', 'repeat' => 'daily', 'repeat_anchor' => '2026-10-23'])->save();
    $move = $this->postJson('/api/v1/notes', confirmNote('move call mum to sunday'))->assertCreated()
        ->assertJsonPath('note.status', 'confirm');
    expect($task->fresh()->due_date)->toBe('2026-10-23')->and(Task::count())->toBe(1);
    $this->postJson('/api/v1/notes/'.$move->json('note.id').'/apply')->assertOk();
    expect($task->fresh()->due_date)->toBe('2026-10-25')->and($task->fresh()->repeat_anchor)->toBe('2026-10-23');

    $payload = confirmNote('done call mum');
    $done = $this->postJson('/api/v1/notes', $payload)->assertCreated()->assertJsonPath('note.status', 'confirm');
    expect($task->fresh()->done)->toBeFalse()->and(Task::count())->toBe(1);
    $this->postJson('/api/v1/notes/'.$done->json('note.id').'/apply')->assertOk()->assertJsonCount(2, 'changes');
    $next = Task::where('previous_occurrence_id', $task->id)->firstOrFail();
    expect($task->fresh()->done)->toBeTrue()->and($next->due_date)->toBe('2026-10-26')
        ->and($next->repeat_anchor)->toBe('2026-10-23')->and(Task::count())->toBe(2);
    $this->postJson('/api/v1/notes', $payload)->assertOk()->assertJsonPath('note.status', 'done');
    $this->postJson('/api/v1/notes/'.$done->json('note.id').'/apply')->assertStatus(409);
    expect(Task::count())->toBe(2);
});
