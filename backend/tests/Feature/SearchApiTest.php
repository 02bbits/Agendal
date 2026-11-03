<?php

declare(strict_types=1);

use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
});

function makeTask(User $user, array $attributes = []): Task
{
    return Task::forceCreate(array_merge([
        'id' => (string) Str::uuid7(),
        'user_id' => $user->id,
        'title' => 'Default task',
        'done' => false,
    ], $attributes));
}

it('requires authentication for search', function () {
    $this->getJson('/api/v1/tasks/search?q=test')
        ->assertStatus(401);
});

it('scopes search results to the authenticated user (SEC-12)', function () {
    $otherUser = User::factory()->create();
    makeTask($otherUser, ['title' => 'Secret project of other user']);
    $myTask = makeTask($this->user, ['title' => 'Secret project of mine']);

    $response = $this->actingAs($this->user)
        ->getJson('/api/v1/tasks/search?q=secret')
        ->assertOk()
        ->assertJsonCount(1, 'items');

    expect($response->json('items.0.id'))->toBe($myTask->id);
});

it('normalizes case and accents both ways (LV-E5, T-LV-105)', function () {
    makeTask($this->user, ['title' => 'Bài tập SQL tuần 5']);
    makeTask($this->user, ['title' => 'Meet at café']);
    makeTask($this->user, ['title' => 'Đồ án tốt nghiệp']);

    // Without accents finds accented
    $res1 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=bai tap')->assertOk();
    expect($res1->json('items'))->toHaveCount(1)
        ->and($res1->json('items.0.title'))->toBe('Bài tập SQL tuần 5');

    // With accents finds accented
    $res2 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=Bài tập')->assertOk();
    expect($res2->json('items'))->toHaveCount(1)
        ->and($res2->json('items.0.title'))->toBe('Bài tập SQL tuần 5');

    // Uppercase
    $res3 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=BÀI TẬP')->assertOk();
    expect($res3->json('items'))->toHaveCount(1)
        ->and($res3->json('items.0.title'))->toBe('Bài tập SQL tuần 5');

    // Café
    $res4 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=cafe')->assertOk();
    expect($res4->json('items'))->toHaveCount(1)
        ->and($res4->json('items.0.title'))->toBe('Meet at café');

    // Đồ án / do an
    $res5 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=do an')->assertOk();
    expect($res5->json('items'))->toHaveCount(1)
        ->and($res5->json('items.0.title'))->toBe('Đồ án tốt nghiệp');
});

it('covers titles and notes, completed included, every word in any order (T-LV-20)', function () {
    makeTask($this->user, [
        'title' => 'Draw ER diagram',
        'due_date' => '2026-10-30',
        'notes' => 'for the SQL course',
    ]);
    makeTask($this->user, [
        'title' => 'Prepare slides',
        'due_date' => '2026-10-24',
        'notes' => 'include the ER diagram',
    ]);
    makeTask($this->user, [
        'title' => 'ER diagram draft',
        'done' => true,
        'done_at' => '2026-10-20T08:00:00Z',
        'due_date' => '2026-10-20',
    ]);

    // Words in any order across title and notes
    $res = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=diagram er')->assertOk();
    $titles = collect($res->json('items'))->pluck('title')->all();
    expect($titles)->toEqual(['Draw ER diagram', 'ER diagram draft', 'Prepare slides']);

    // Search matches in notes
    $resNotes = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=sql course')->assertOk();
    $noteTitles = collect($resNotes->json('items'))->pluck('title')->all();
    expect($noteTitles)->toEqual(['Draw ER diagram']);
});

it('ranks title matches first, then open before completed, then soonest due (T-LV-107, LV-E7)', function () {
    makeTask($this->user, [
        'title' => 'Prepare slides',
        'due_date' => '2026-10-24',
        'notes' => 'include the ER diagram',
        'done' => false,
    ]);
    makeTask($this->user, [
        'title' => 'ER diagram draft',
        'done' => true,
        'due_date' => '2026-10-20',
    ]);
    makeTask($this->user, [
        'title' => 'Draw ER diagram',
        'due_date' => '2026-10-30',
        'notes' => 'for the SQL course',
        'done' => false,
    ]);

    $res = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=er diagram')->assertOk();
    $titles = collect($res->json('items'))->pluck('title')->all();

    // "Draw ER diagram": title match & open -> 1st
    // "ER diagram draft": title match & completed -> 2nd
    // "Prepare slides": notes match & open -> 3rd
    expect($titles)->toEqual([
        'Draw ER diagram',
        'ER diagram draft',
        'Prepare slides',
    ]);
});

it('counts All / Open / Completed for the query and filters correctly (T-LV-21)', function () {
    makeTask($this->user, ['title' => 'Diagram open 1', 'done' => false]);
    makeTask($this->user, ['title' => 'Diagram open 2', 'done' => false]);
    makeTask($this->user, ['title' => 'Diagram done 1', 'done' => true]);

    // status=completed
    $res = $this->actingAs($this->user)
        ->getJson('/api/v1/tasks/search?q=diagram&status=completed')
        ->assertOk();

    expect($res->json('counts'))->toBe(['all' => 3, 'open' => 2, 'completed' => 1])
        ->and($res->json('items'))->toHaveCount(1)
        ->and($res->json('items.0.title'))->toBe('Diagram done 1');

    // status=open
    $resOpen = $this->actingAs($this->user)
        ->getJson('/api/v1/tasks/search?q=diagram&status=open')
        ->assertOk();

    expect($resOpen->json('counts'))->toBe(['all' => 3, 'open' => 2, 'completed' => 1])
        ->and($resOpen->json('items'))->toHaveCount(2);

    // invalid status returns 422
    $this->actingAs($this->user)
        ->getJson('/api/v1/tasks/search?q=diagram&status=invalid')
        ->assertStatus(422);
});

it('treats %, _ and quotes as literal text (LV-E6, T-LV-106, SEC-22)', function () {
    makeTask($this->user, ['title' => '100% complete task']);
    makeTask($this->user, ['title' => 'done_check status']);
    makeTask($this->user, ['title' => 'He said "quoted" here']);
    makeTask($this->user, ['title' => 'Normal task']);

    $resPercent = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=100%')->assertOk();
    expect($resPercent->json('items'))->toHaveCount(1)
        ->and($resPercent->json('items.0.title'))->toBe('100% complete task');

    $resUnderscore = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=done_check')->assertOk();
    expect($resUnderscore->json('items'))->toHaveCount(1)
        ->and($resUnderscore->json('items.0.title'))->toBe('done_check status');

    $resQuote = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q="quoted"')->assertOk();
    expect($resQuote->json('items'))->toHaveCount(1)
        ->and($resQuote->json('items.0.title'))->toBe('He said "quoted" here');
});

it('excludes soft deleted tasks', function () {
    $task = makeTask($this->user, ['title' => 'Deleted task to be ignored']);
    $task->delete();

    $res = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=Deleted task')->assertOk();
    expect($res->json('items'))->toHaveCount(0)
        ->and($res->json('counts.all'))->toBe(0);
});

it('returns empty results when query is empty or whitespace', function () {
    makeTask($this->user, ['title' => 'Some task']);

    $resEmpty = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=')->assertOk();
    expect($resEmpty->json('items'))->toBeEmpty()
        ->and($resEmpty->json('counts'))->toBe(['all' => 0, 'open' => 0, 'completed' => 0])
        ->and($resEmpty->json('next_cursor'))->toBeNull();

    $resSpaces = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q='.urlencode('   '))->assertOk();
    expect($resSpaces->json('items'))->toBeEmpty()
        ->and($resSpaces->json('counts'))->toBe(['all' => 0, 'open' => 0, 'completed' => 0])
        ->and($resSpaces->json('next_cursor'))->toBeNull();
});

it('supports keyset pagination for 50 results per page', function () {
    for ($i = 1; $i <= 55; $i++) {
        makeTask($this->user, [
            'title' => sprintf('Batch task %02d', $i),
            'due_date' => sprintf('2026-11-%02d', min($i, 28)),
        ]);
    }

    $page1 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=Batch task')->assertOk();
    expect($page1->json('items'))->toHaveCount(50)
        ->and($page1->json('counts.all'))->toBe(55)
        ->and($page1->json('next_cursor'))->not->toBeNull();

    $cursor = $page1->json('next_cursor');
    $page2 = $this->actingAs($this->user)->getJson('/api/v1/tasks/search?q=Batch task&cursor='.$cursor)->assertOk();
    expect($page2->json('items'))->toHaveCount(5)
        ->and($page2->json('next_cursor'))->toBeNull();

    // Ensure all 55 unique task IDs were returned across both pages
    $allIds = array_merge(
        collect($page1->json('items'))->pluck('id')->all(),
        collect($page2->json('items'))->pluck('id')->all()
    );
    expect(count($allIds))->toBe(55)
        ->and(count(array_unique($allIds)))->toBe(55);
});
