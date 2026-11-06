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

it('clears source_note_id on tasks and keeps tasks intact when note is deleted', function () {
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
        ->and($task->fresh())->not->toBeNull()
        ->and($task->fresh()->source_note_id)->toBeNull();
});
