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
    $this->stranger = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
});

function createTestNote(User $user, array $attributes = []): Note
{
    $note = new Note;
    $note->forceFill([
        'user_id' => $user->id,
        'client_id' => (string) Str::uuid(),
        'text' => 'test note text',
        'status' => 'pending',
        'written_at' => '2026-10-23T08:12:00+07:00',
        'written_tz' => 'Asia/Ho_Chi_Minh',
        'processed_at' => '2026-10-23T08:12:00+07:00',
        ...$attributes,
    ])->save();

    return $note;
}

it('lets the owner delete a note (204 No Content)', function () {
    $note = createTestNote($this->owner);

    $this->actingAs($this->owner)
        ->deleteJson("/api/v1/notes/{$note->id}")
        ->assertNoContent();

    expect(Note::find($note->id))->toBeNull();
});

it('removes the deleted note from the list and decreases total and needs_count', function () {
    $note1 = createTestNote($this->owner, ['status' => 'pending']);
    $note2 = createTestNote($this->owner, ['status' => 'done']);

    $before = $this->actingAs($this->owner)->getJson('/api/v1/notes')->json();
    expect($before['total'])->toBe(2)->and($before['needs_count'])->toBe(1);

    $this->actingAs($this->owner)
        ->deleteJson("/api/v1/notes/{$note1->id}")
        ->assertNoContent();

    $after = $this->actingAs($this->owner)->getJson('/api/v1/notes')->json();
    expect($after['total'])->toBe(1)->and($after['needs_count'])->toBe(0)
        ->and(collect($after['items'])->pluck('id'))->not->toContain($note1->id);
});

it('refuses deletion by someone else with 404 (SEC-12)', function () {
    $note = createTestNote($this->owner);

    $this->actingAs($this->stranger)
        ->deleteJson("/api/v1/notes/{$note->id}")
        ->assertNotFound();

    expect(Note::withoutGlobalScopes()->find($note->id))->not->toBeNull();
});

it('requires authentication to delete a note', function () {
    $note = createTestNote($this->owner);

    $this->deleteJson("/api/v1/notes/{$note->id}")
        ->assertUnauthorized();

    expect(Note::withoutGlobalScopes()->find($note->id))->not->toBeNull();
});

it('keeps source_note_id on tasks while the note is only trashed', function () {
    $note = createTestNote($this->owner, ['status' => 'done']);
    $task = new Task;
    $task->forceFill([
        'user_id' => $this->owner->id,
        'title' => 'Important meeting',
        'source_note_id' => $note->id,
    ])->save();

    expect($task->fresh()->source_note_id)->toBe($note->id);

    $this->actingAs($this->owner)
        ->deleteJson("/api/v1/notes/{$note->id}")
        ->assertNoContent();

    expect(Note::find($note->id))->toBeNull()
        ->and(Note::withTrashed()->find($note->id)->trashed())->toBeTrue()
        ->and($task->fresh()->source_note_id)->toBe($note->id);
});

it('restores a deleted note into the list and counts (Undo)', function () {
    $note = createTestNote($this->owner, ['status' => 'pending']);
    $this->actingAs($this->owner)->deleteJson("/api/v1/notes/{$note->id}")->assertNoContent();
    $this->actingAs($this->owner)->getJson("/api/v1/notes/{$note->id}")->assertNotFound();

    $this->actingAs($this->owner)->postJson("/api/v1/notes/{$note->id}/restore")
        ->assertOk()->assertJsonPath('note.id', $note->id)->assertJsonPath('note.status', 'pending');

    $list = $this->actingAs($this->owner)->getJson('/api/v1/notes')->json();
    expect($list['total'])->toBe(1)->and($list['needs_count'])->toBe(1)
        ->and(collect($list['items'])->pluck('id'))->toContain($note->id);
});

it('restores a live note as a no-op', function () {
    $note = createTestNote($this->owner, ['status' => 'done']);

    $this->actingAs($this->owner)->postJson("/api/v1/notes/{$note->id}/restore")
        ->assertOk()->assertJsonPath('note.status', 'done');
});

it('refuses restoring by someone else with 404 (SEC-12)', function () {
    $note = createTestNote($this->owner);
    $note->delete();

    $this->actingAs($this->stranger)->postJson("/api/v1/notes/{$note->id}/restore")->assertNotFound();

    expect(Note::withoutGlobalScopes()->find($note->id)->trashed())->toBeTrue();
});

it('requires authentication to restore a note', function () {
    $note = createTestNote($this->owner);
    $note->delete();

    $this->postJson("/api/v1/notes/{$note->id}/restore")->assertUnauthorized();
});

it('replays POST /notes of a trashed note by client_id without creating another', function () {
    $note = createTestNote($this->owner);
    $note->delete();

    $this->actingAs($this->owner)->postJson('/api/v1/notes', [
        'client_id' => $note->client_id, 'text' => 'test note text',
        'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertOk()->assertJsonPath('note.id', $note->id);

    expect(Note::withTrashed()->count())->toBe(1);
});
