<?php

use App\Models\Note;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

function savedListNote(int $owner, string $status = 'confirm'): Note
{
    $note = new Note;
    $note->forceFill(['user_id' => $owner, 'client_id' => (string) Str::uuid(), 'text' => 'A saved note', 'status' => $status, 'written_at' => now(), 'written_tz' => 'UTC', 'processed_at' => now(), 'engine' => 'rules', 'plan' => [], 'applied' => []])->save();

    return $note;
}

it('lists only the owners notes and counts with status filters', function () {
    foreach (['confirm', 'followup', 'done', 'kept', 'pending'] as $status) {
        savedListNote($this->user->id, $status);
    }
    savedListNote(User::factory()->create()->id);
    $this->getJson('/api/v1/notes')->assertOk()->assertJsonCount(5, 'items')->assertJsonPath('total', 5)->assertJsonPath('needs_count', 3);
    $this->getJson('/api/v1/notes?filter=needs')->assertOk()->assertJsonCount(3, 'items');
    $this->getJson('/api/v1/notes?filter=made')->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.status', 'done');
    $this->getJson('/api/v1/notes?filter=kept')->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.status', 'kept');
    $this->getJson('/api/v1/notes?filter=other')->assertUnprocessable();
});

it('paginates tied timestamps without losing or repeating notes', function () {
    for ($i = 0; $i < 27; $i++) {
        savedListNote($this->user->id);
    }
    $first = $this->getJson('/api/v1/notes')->assertOk()->assertJsonCount(20, 'items');
    $next = $this->getJson('/api/v1/notes?cursor='.urlencode($first->json('next_cursor')))->assertOk()->assertJsonCount(7, 'items')->assertJsonPath('next_cursor', null);
    expect(array_intersect(array_column($first->json('items'), 'id'), array_column($next->json('items'), 'id')))->toBe([]);
});
