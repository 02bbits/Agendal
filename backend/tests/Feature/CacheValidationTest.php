<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

// #201: GET /counts and GET /sync answer 304 while the user's data and local date are unchanged.
// Truncation, as in SyncTest: the pull only tags a page once its rows have committed.
uses(DatabaseTruncation::class);

beforeEach(function () {
    $this->clock = new FrozenClock('2026-10-23T01:12:00Z');
    app()->instance(ClockInterface::class, $this->clock);
    $this->travelTo(Carbon::instance($this->clock->now()));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    $this->task = (string) Str::uuid();
    $this->postJson('/api/v1/tasks', ['id' => $this->task, 'title' => 'Buy milk', 'due_date' => '2026-10-23'])->assertCreated();
    $this->project = (string) Str::uuid();
    $this->postJson('/api/v1/projects', ['id' => $this->project, 'name' => 'Home', 'colour' => 'blue'])->assertCreated();
});

// Truncation only runs before a test: the rows left would show up in the files after this one
afterEach(fn () => $this->truncateTablesForAllConnections());

function tagOf(string $path): string
{
    return (string) test()->getJson($path)->assertOk()->headers->get('ETag');
}

function assertNotModified(string $path, string $tag): void
{
    $response = test()->getJson($path, ['If-None-Match' => $tag])->assertStatus(304);
    expect($response->getContent())->toBe('');
}

function makeConfirmNote(): string
{
    return test()->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => 'call mum tomorrow', 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->assertJsonPath('note.status', 'confirm')->json('note.id');
}

it('answers 304 with no body while nothing changed', function (string $path) {
    $tag = tagOf($path);

    expect($tag)->toStartWith('W/"');
    assertNotModified($path, $tag);
    // A proxy may drop the weak marker
    assertNotModified($path, substr($tag, 2));
})->with(['/api/v1/counts', '/api/v1/sync?cursor=0']);

it('changes the tag on every write', function (?Closure $before, Closure $write) {
    $before?->call($this);
    $tag = tagOf('/api/v1/counts');

    $write->call($this);

    $this->getJson('/api/v1/counts', ['If-None-Match' => $tag])->assertOk();
    expect(tagOf('/api/v1/counts'))->not->toBe($tag);
})->with([
    'task create' => [null, fn () => $this->postJson('/api/v1/tasks', ['id' => (string) Str::uuid(), 'title' => 'Read'])->assertCreated()],
    'task edit' => [null, fn () => $this->patchJson("/api/v1/tasks/{$this->task}", ['title' => 'Buy oat milk'])->assertOk()],
    'task complete' => [null, fn () => $this->postJson("/api/v1/tasks/{$this->task}/complete")->assertOk()],
    'task reopen' => [fn () => $this->postJson("/api/v1/tasks/{$this->task}/complete")->assertOk(), fn () => $this->postJson("/api/v1/tasks/{$this->task}/reopen")->assertOk()],
    'task delete' => [null, fn () => $this->deleteJson("/api/v1/tasks/{$this->task}")->assertSuccessful()],
    'task restore' => [fn () => $this->deleteJson("/api/v1/tasks/{$this->task}")->assertSuccessful(), fn () => $this->postJson("/api/v1/tasks/{$this->task}/restore")->assertOk()],
    'project create' => [null, fn () => $this->postJson('/api/v1/projects', ['id' => (string) Str::uuid(), 'name' => 'Work', 'colour' => 'red'])->assertCreated()],
    'project edit' => [null, fn () => $this->patchJson("/api/v1/projects/{$this->project}", ['name' => 'House'])->assertOk()],
    'project delete' => [null, fn () => $this->deleteJson("/api/v1/projects/{$this->project}")->assertSuccessful()],
    'note write' => [null, fn () => makeConfirmNote()],
    'note apply' => [fn () => $this->note = makeConfirmNote(), fn () => $this->postJson("/api/v1/notes/{$this->note}/apply")->assertOk()],
    'note undo' => [function () {
        $this->note = makeConfirmNote();
        $this->postJson("/api/v1/notes/{$this->note}/apply")->assertOk();
    }, fn () => $this->postJson("/api/v1/notes/{$this->note}/undo")->assertOk()],
    'sync patches' => [null, fn () => $this->postJson('/api/v1/sync/patches', [
        ['entity' => 'task', 'id' => $this->task, 'field' => 'title', 'value' => 'Buy bread', 'at' => '2026-10-23T01:15:00Z'],
    ])->assertOk()],
]);

it('keeps my tag when another user writes', function (string $path) {
    $tag = tagOf($path);

    $this->actingAs(User::factory()->create());
    $this->postJson('/api/v1/tasks', ['id' => (string) Str::uuid(), 'title' => 'Theirs', 'due_date' => '2026-10-23'])->assertCreated();

    $this->actingAs($this->user);
    assertNotModified($path, $tag);
})->with(['/api/v1/counts', '/api/v1/sync?cursor=0']);

it('changes the tag on a new local day', function () {
    $tag = tagOf('/api/v1/counts');

    $this->clock->advance('+1 day');

    $this->getJson('/api/v1/counts', ['If-None-Match' => $tag])->assertOk();
});

it('tags a sync page only once it is caught up', function () {
    $first = $this->getJson('/api/v1/sync?cursor=0&limit=1')->assertOk()->assertJsonPath('has_more', true);
    expect($first->headers->has('ETag'))->toBeFalse();

    $cursor = $this->getJson('/api/v1/sync?cursor=0')->assertOk()->assertJsonPath('has_more', false)->json('next_cursor');
    $path = "/api/v1/sync?cursor={$cursor}";
    $tag = tagOf($path);
    assertNotModified($path, $tag);

    $this->patchJson("/api/v1/tasks/{$this->task}", ['title' => 'Buy oat milk'])->assertOk();
    $this->getJson($path, ['If-None-Match' => $tag])->assertOk()->assertJsonCount(1, 'changes.tasks');
});

it('never lets a shared cache keep user data (SEC-51)', function (string $path) {
    $ok = $this->getJson($path)->assertOk();
    $notModified = $this->getJson($path, ['If-None-Match' => $ok->headers->get('ETag')])->assertStatus(304);

    foreach ([$ok, $notModified] as $response) {
        expect($response->headers->get('Cache-Control'))->toContain('no-store')->toContain('private')->not->toContain('public');
    }
})->with(['/api/v1/counts', '/api/v1/sync?cursor=0']);
