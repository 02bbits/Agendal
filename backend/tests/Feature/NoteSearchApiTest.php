<?php

declare(strict_types=1);

use App\Models\Note;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
});

function makeNote(User $user, array $attributes = []): Note
{
    static $seq = 1;

    return Note::forceCreate(array_merge([
        'id' => (string) Str::uuid7(),
        'user_id' => $user->id,
        'client_id' => (string) Str::uuid(),
        'text' => 'Default note text',
        'name' => null,
        'status' => 'done',
        'written_at' => '2026-10-23T08:12:00Z',
        'written_tz' => 'UTC',
        'change_seq' => $seq++,
    ], $attributes));
}

it('requires authentication for note search', function () {
    $this->getJson('/api/v1/notes/search?q=test')
        ->assertStatus(401);
});

it('scopes note search results to the authenticated user', function () {
    $otherUser = User::factory()->create();
    makeNote($otherUser, ['text' => 'Private note for other user']);
    $myNote = makeNote($this->user, ['text' => 'Private note of mine']);

    $res = $this->actingAs($this->user)
        ->getJson('/api/v1/notes/search?q=private')
        ->assertOk()
        ->assertJsonCount(1, 'items');

    expect($res->json('items.0.id'))->toBe($myNote->id);
});

it('normalizes case and accents both ways for notes', function () {
    makeNote($this->user, ['text' => 'Bài tập tiếng Việt']);
    makeNote($this->user, ['text' => 'Café meeting in city']);

    $res1 = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=bai tap')->assertOk();
    expect($res1->json('items'))->toHaveCount(1)
        ->and($res1->json('items.0.snippet'))->toContain('Bài tập');

    $res2 = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=BÀI TẬP')->assertOk();
    expect($res2->json('items'))->toHaveCount(1);

    $res3 = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=cafe')->assertOk();
    expect($res3->json('items'))->toHaveCount(1)
        ->and($res3->json('items.0.snippet'))->toContain('Café');
});

it('treats %, _ and ! as literal in note search', function () {
    makeNote($this->user, ['text' => 'Discount 100% on special item_1!']);
    makeNote($this->user, ['text' => 'Discount 1000 on special itemX1.']);

    $resPercent = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=100%')->assertOk();
    expect($resPercent->json('items'))->toHaveCount(1);

    $resUnderscore = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=item_1')->assertOk();
    expect($resUnderscore->json('items'))->toHaveCount(1);

    $resExcl = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=item_1!')->assertOk();
    expect($resExcl->json('items'))->toHaveCount(1);
});

it('matches notes by name', function () {
    makeNote($this->user, [
        'name' => 'Weekly Sync Agenda',
        'text' => 'Discuss release dates and budget.',
    ]);

    $res = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=weekly sync')->assertOk();
    expect($res->json('items'))->toHaveCount(1)
        ->and($res->json('items.0.title'))->toBe('Weekly Sync Agenda');
});

it('returns at most 20 note search results', function () {
    for ($i = 1; $i <= 25; $i++) {
        makeNote($this->user, [
            'text' => sprintf('Batch note record %02d for testing', $i),
        ]);
    }

    $res = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=batch note')->assertOk();
    expect($res->json('items'))->toHaveCount(20);
});

it('returns only id, title, snippet, status, written_at in note results', function () {
    makeNote($this->user, [
        'text' => 'Testing secret content for payload check',
        'plan' => ['step' => 1],
        'status' => 'done',
    ]);

    $res = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=secret')->assertOk();
    expect($res->json('items'))->toHaveCount(1);

    $item = $res->json('items.0');
    $keys = array_keys($item);
    sort($keys);
    expect($keys)->toBe(['id', 'snippet', 'status', 'title', 'written_at'])
        ->and($item)->not->toHaveKey('plan')
        ->and($item)->not->toHaveKey('text')
        ->and($item)->not->toHaveKey('applied')
        ->and($item)->not->toHaveKey('undo_log');
});

it('produces snippet <= 122 characters containing matched word deep in a note', function () {
    $deepWord = 'supercalifragilistic';
    $longText = str_repeat('alpha beta ', 30).$deepWord.' '.str_repeat('gamma delta ', 30);

    makeNote($this->user, ['text' => $longText]);

    $res = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q='.$deepWord)->assertOk();
    expect($res->json('items'))->toHaveCount(1);

    $snippet = $res->json('items.0.snippet');
    expect(mb_strlen($snippet))->toBeLessThanOrEqual(122)
        ->and($snippet)->toContain($deepWord)
        ->and(str_starts_with($snippet, '…'))->toBeTrue()
        ->and(str_ends_with($snippet, '…'))->toBeTrue();
});

it('validates note search request query parameter', function () {
    $this->actingAs($this->user)->getJson('/api/v1/notes/search?q[]=x')->assertStatus(422);
    $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=test%00invalid')->assertStatus(422);
});

it('returns empty list when note search query is empty', function () {
    makeNote($this->user, ['text' => 'Some existing note']);

    $res1 = $this->actingAs($this->user)->getJson('/api/v1/notes/search?q=')->assertOk();
    expect($res1->json())->toBe(['items' => []]);

    $res2 = $this->actingAs($this->user)->getJson('/api/v1/notes/search')->assertOk();
    expect($res2->json())->toBe(['items' => []]);
});
