<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->clock = new FrozenClock('2026-10-23T08:12:00+07:00');
    app()->instance(ClockInterface::class, $this->clock);
    $this->owner = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
});

function seedTask(User $user, array $fields): Task
{
    $task = new Task;
    $task->forceFill(['user_id' => $user->id, ...$fields])->save();

    return $task;
}

/** A note made and applied, as Check this first's Apply changes leaves it (NU-5). */
function makeNote(string $text): array
{
    $id = test()->actingAs(test()->owner)->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => $text, 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonPath('note.status', 'confirm')->json('note.id');

    return test()->postJson("/api/v1/notes/{$id}/apply")->assertOk()->json();
}

it('removes created tasks and keeps the note as pending (T-RV-10, T-RV-12)', function () {
    $id = makeNote('call mum tomorrow; read report')['note']['id'];
    expect(Task::count())->toBe(2);
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk()->assertJsonPath('note.status', 'pending')->assertJsonStructure(['redo_until']);
    expect(Task::count())->toBe(0)->and(Task::onlyTrashed()->count())->toBe(2)->and(Note::findOrFail($id)->status)->toBe('pending');
});

it('gives a rescheduled task its old date back (T-RV-10)', function () {
    $task = seedTask($this->owner, ['title' => 'Email group', 'due_date' => '2026-10-24']);
    $id = makeNote('move email group to 2026-10-30')['note']['id'];
    expect($task->fresh()->due_date)->toBe('2026-10-30');
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk();
    expect($task->fresh()->due_date)->toBe('2026-10-24');
});

it('keeps a field the user changed since (RV-E1, RV-E7)', function () {
    $task = seedTask($this->owner, ['title' => 'Email group', 'due_date' => '2026-10-24']);
    $id = makeNote('move email group to 2026-10-30')['note']['id'];
    $task->forceFill(['due_date' => '2026-11-05'])->save();
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk();
    expect($task->fresh()->due_date)->toBe('2026-11-05');
});

it('reopens a completed task (T-RV-10)', function () {
    $task = seedTask($this->owner, ['title' => 'Email group', 'due_date' => '2026-10-23']);
    $id = makeNote('done email group')['note']['id'];
    expect($task->fresh()->done)->toBeTrue();
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk();
    expect($task->fresh()->done)->toBeFalse()->and($task->fresh()->done_at)->toBeNull();
});

it('restores a task the note deleted, from the log (T-RV-10)', function () {
    $task = seedTask($this->owner, ['title' => 'Old reading list']);
    $task->delete();
    $note = new Note;
    $note->forceFill([
        'user_id' => $this->owner->id, 'client_id' => (string) Str::uuid(), 'text' => 'x', 'status' => 'done',
        'written_at' => $this->clock->now(), 'written_tz' => 'UTC', 'processed_at' => $this->clock->now(),
        'applied' => [['kind' => 'deleted', 'task_id' => $task->id, 'before' => $task->attributesToArray(), 'after' => $task->attributesToArray(), 'label' => 'x']],
    ])->save();
    $this->actingAs($this->owner)->postJson("/api/v1/notes/{$note->id}/undo")->assertOk();
    expect($task->fresh())->not->toBeNull()->and(Task::count())->toBe(1);
});

it('asks before removing a created task edited since (RV-E1)', function () {
    $note = makeNote('call mum tomorrow');
    $task = Task::firstOrFail();
    $task->forceFill(['title' => 'Call mum at 6'])->save();
    $this->postJson("/api/v1/notes/{$note['note']['id']}/undo")->assertStatus(409)->assertJsonPath('error.code', 'note.undo_conflicts')->assertJsonPath('error.tasks.0.id', $task->id);
    expect(Task::count())->toBe(1);
    $this->postJson("/api/v1/notes/{$note['note']['id']}/undo", ['confirm_conflicts' => true])->assertOk();
    expect(Task::count())->toBe(0);
});

it('refuses after 30 days and a note that is not done (RV-E2)', function () {
    $id = makeNote('call mum tomorrow')['note']['id'];
    $this->clock->advance('+31 days');
    $this->postJson("/api/v1/notes/{$id}/undo")->assertStatus(409)->assertJsonPath('error.code', 'note.undo_expired');
    expect(Task::count())->toBe(1);
});

it('answers a second undo with the note already pending (T-RV-105, RV-E5)', function () {
    $id = makeNote('call mum tomorrow')['note']['id'];
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk()->assertJsonPath('note.status', 'pending');
    expect(Task::count())->toBe(0);
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk()->assertJsonPath('note.status', 'pending');
    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('pending');
});

it('changes nothing when a failure hits mid-undo (T-RV-13, NF-11)', function () {
    $id = makeNote('call mum tomorrow; read report')['note']['id'];
    $saves = 0;
    Task::saving(function () use (&$saves) {
        if (++$saves === 2) {
            throw new RuntimeException('boom');
        }
    });
    $this->withoutExceptionHandling();
    expect(fn () => $this->postJson("/api/v1/notes/{$id}/undo"))->toThrow(RuntimeException::class);
    expect(Task::count())->toBe(2)->and(Note::findOrFail($id)->status)->toBe('done');
});

it('redoes within 10 s and not after (T-RV-106, RV-E6)', function () {
    $id = makeNote('call mum tomorrow')['note']['id'];
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk();
    $this->clock->advance('+5 seconds');
    $this->postJson("/api/v1/notes/{$id}/redo")->assertOk()->assertJsonPath('note.status', 'done');
    expect(Task::count())->toBe(1);
    $this->postJson("/api/v1/notes/{$id}/undo")->assertOk();
    $this->clock->advance('+11 seconds');
    $this->postJson("/api/v1/notes/{$id}/redo")->assertStatus(409)->assertJsonPath('error.code', 'note.redo_expired');
    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('pending');
});

it('returns a note by id and 404 for someone else (SEC-12)', function () {
    $id = makeNote('call mum tomorrow')['note']['id'];
    $this->getJson("/api/v1/notes/{$id}")->assertOk()->assertJsonPath('note.id', $id);
    $other = User::factory()->create();
    $this->actingAs($other)->getJson("/api/v1/notes/{$id}")->assertNotFound();
    $this->postJson("/api/v1/notes/{$id}/undo")->assertNotFound();
});
