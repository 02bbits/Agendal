<?php

declare(strict_types=1);

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

// IM-52: GET /sync and POST /sync/patches (ADR-004, ADR-005, AP §7-8)
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->clock = new FrozenClock('2026-10-23T01:12:00Z');
    app()->instance(ClockInterface::class, $this->clock);
    $this->travelTo(Carbon::instance($this->clock->now()));
    $this->withHeader('X-Timezone', 'Asia/Ho_Chi_Minh');
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

function newTask(array $body = []): string
{
    $id = (string) Str::uuid();
    test()->postJson('/api/v1/tasks', ['id' => $id, 'title' => 'Buy milk', ...$body])->assertCreated();

    return $id;
}

function newProject(string $name = 'Home'): string
{
    $id = (string) Str::uuid();
    test()->postJson('/api/v1/projects', ['id' => $id, 'name' => $name, 'colour' => 'blue'])->assertCreated();

    return $id;
}

/** The time `seconds` after the frozen now, as a device would stamp a patch. */
function at(int $seconds): string
{
    return test()->clock->now()->modify("{$seconds} seconds")->format(DATE_ATOM);
}

function patches(array $rows): array
{
    return test()->postJson('/api/v1/sync/patches', $rows)->assertOk()->json('results');
}

describe('GET /sync', function () {
    it('returns changes after the cursor, oldest first, then nothing more', function () {
        $first = newTask(['title' => 'One']);
        $project = newProject();

        $pull = $this->getJson('/api/v1/sync?cursor=0')->assertOk();
        expect($pull->json('changes.tasks.0'))->toMatchArray(['id' => $first, 'title' => 'One', 'deleted_at' => null])
            ->and($pull->json('changes.projects.0'))->toMatchArray(['id' => $project, 'name' => 'Home', 'deleted_at' => null])
            ->and($pull->json('changes.projects.0'))->not->toHaveKey('open')
            ->and($pull->json('has_more'))->toBeFalse();

        $cursor = $pull->json('next_cursor');
        expect($this->getJson("/api/v1/sync?cursor={$cursor}")->json('changes'))
            ->toBe(['tasks' => [], 'projects' => [], 'notes' => []]);

        $this->clock->advance('+1 minute');
        $this->patchJson("/api/v1/tasks/{$first}", ['title' => 'One, renamed'])->assertOk();
        expect($this->getJson("/api/v1/sync?cursor={$cursor}")->json('changes.tasks.0.title'))->toBe('One, renamed');
    });

    it('includes tombstones in a delta pull, not in a full one', function () {
        $id = newTask();
        $this->deleteJson("/api/v1/tasks/{$id}")->assertNoContent();

        expect($this->getJson('/api/v1/sync?cursor=0')->json('changes.tasks.0.deleted_at'))->not->toBeNull()
            ->and($this->getJson('/api/v1/sync?cursor=0&full=1')->json('changes.tasks'))->toBe([]);
    });

    it('pages by limit with next_cursor and has_more', function () {
        $ids = [newTask(), newTask(), newTask()];

        $page = $this->getJson('/api/v1/sync?cursor=0&limit=2')->assertOk();
        expect(array_column($page->json('changes.tasks'), 'id'))->toBe(array_slice($ids, 0, 2))
            ->and($page->json('has_more'))->toBeTrue();

        $rest = $this->getJson('/api/v1/sync?cursor='.$page->json('next_cursor').'&limit=2');
        expect(array_column($rest->json('changes.tasks'), 'id'))->toBe([$ids[2]])
            ->and($rest->json('has_more'))->toBeFalse();
    });

    it('a full download keeps open tasks and those completed in the last 90 days', function () {
        $open = newTask();
        $recent = newTask();
        $old = newTask();
        $this->postJson("/api/v1/tasks/{$recent}/complete")->assertOk();
        Task::query()->whereKey($old)->update(['done' => true, 'done_at' => '2026-07-01T00:00:00Z']);

        expect(array_column($this->getJson('/api/v1/sync?full=1')->json('changes.tasks'), 'id'))
            ->toEqualCanonicalizing([$open, $recent]);
    });

    it('answers 410 to a cursor older than purged tombstones (AP-E8, OFF-15)', function () {
        $id = newTask();
        $cursor = $this->getJson('/api/v1/sync')->json('next_cursor');
        $this->deleteJson("/api/v1/tasks/{$id}")->assertNoContent();

        $this->clock->advance('+31 days');
        $this->travelTo(Carbon::instance($this->clock->now()));
        $this->artisan('sync:purge')->assertSuccessful();

        expect(Task::withTrashed()->find($id))->toBeNull();
        $this->getJson("/api/v1/sync?cursor={$cursor}")->assertStatus(410);
        $this->getJson('/api/v1/sync?cursor=0&full=1')->assertOk();
    });

    it("never returns another user's rows", function () {
        newTask();
        $this->actingAs(User::factory()->create());

        expect($this->getJson('/api/v1/sync')->json('changes.tasks'))->toBe([]);
    });
});

describe('POST /sync/patches', function () {
    it('applies a later edit and answers stale with the current value to an older one', function () {
        $id = newTask();

        expect(patches([['entity' => 'task', 'id' => $id, 'field' => 'title', 'value' => 'Oat milk', 'at' => at(1)]]))
            ->toBe([['index' => 0, 'status' => 'applied']]);
        expect(patches([['entity' => 'task', 'id' => $id, 'field' => 'title', 'value' => 'Soy milk', 'at' => at(-10)]]))
            ->toBe([['index' => 0, 'status' => 'stale', 'current' => 'Oat milk']]);
    });

    it('keeps edits to different fields from two devices (ADR-004)', function () {
        $id = newTask();
        $project = newProject();

        patches([
            ['entity' => 'task', 'id' => $id, 'field' => 'due_date', 'value' => '2026-10-30', 'at' => at(2)],
            ['entity' => 'task', 'id' => $id, 'field' => 'project_id', 'value' => $project, 'at' => at(1)],
        ]);

        expect(Task::find($id))->due_date->not->toBeNull()->project_id->toBe($project);
    });

    it("rejects rows that aren't the user's or name a field off the allow-list, without failing the batch", function () {
        $mine = newTask();
        $this->actingAs($other = User::factory()->create());
        $theirs = newTask();
        $this->actingAs($this->user);

        expect(patches([
            ['entity' => 'task', 'id' => $theirs, 'field' => 'title', 'value' => 'Mine now', 'at' => at(1)],
            ['entity' => 'task', 'id' => $mine, 'field' => 'user_id', 'value' => $other->id, 'at' => at(1)],
            ['entity' => 'task', 'id' => $mine, 'field' => 'created_by', 'value' => 'assistant', 'at' => at(1)],
            ['entity' => 'task', 'id' => $mine, 'field' => 'title', 'value' => 'Still works', 'at' => at(1)],
        ]))->toBe([
            ['index' => 0, 'status' => 'rejected'],
            ['index' => 1, 'status' => 'rejected'],
            ['index' => 2, 'status' => 'rejected'],
            ['index' => 3, 'status' => 'applied'],
        ]);
        expect(Task::withoutGlobalScope('owner')->find($theirs)->title)->toBe('Buy milk');
    });

    it('rejects a value the task rules refuse, with the current value', function () {
        $id = newTask(['due_date' => '2026-10-25']);

        expect(patches([['entity' => 'task', 'id' => $id, 'field' => 'start_date', 'value' => '2026-10-28', 'at' => at(1)]]))
            ->toBe([['index' => 0, 'status' => 'rejected', 'current' => null]]);
    });

    it('answers 422 to a batch over 500 rows or a malformed row', function () {
        $row = ['entity' => 'task', 'id' => (string) Str::uuid(), 'field' => 'title', 'value' => 'x', 'at' => at(0)];

        $this->postJson('/api/v1/sync/patches', array_fill(0, 501, $row))->assertStatus(422);
        $this->postJson('/api/v1/sync/patches', [['entity' => 'note'] + $row])->assertStatus(422);
        $this->postJson('/api/v1/sync/patches', [])->assertStatus(422);
    });

    it('SEC-14: a future timestamp is clamped to server time + 5 min, so a later real edit still wins', function () {
        $id = newTask();
        patches([['entity' => 'task', 'id' => $id, 'field' => 'title', 'value' => 'Forged', 'at' => '2030-01-01T00:00:00Z']]);

        expect(Task::find($id)->field_updated_at['title'])->toBe('2026-10-23T01:17:00Z');

        $this->clock->advance('+10 minutes');
        expect(patches([['entity' => 'task', 'id' => $id, 'field' => 'title', 'value' => 'Real', 'at' => at(0)]]))
            ->toBe([['index' => 0, 'status' => 'applied']]);
    });

    it('OFF-20: completed on two devices offline makes one next occurrence', function () {
        $id = newTask(['due_date' => '2026-10-23', 'repeat' => 'daily']);

        expect(patches([
            ['entity' => 'task', 'id' => $id, 'field' => 'done', 'value' => true, 'at' => at(1)],
            ['entity' => 'task', 'id' => $id, 'field' => 'done', 'value' => true, 'at' => at(2)],
        ]))->toBe([['index' => 0, 'status' => 'applied'], ['index' => 1, 'status' => 'applied']]);

        expect(Task::where('previous_occurrence_id', $id)->count())->toBe(1)
            ->and(Task::find($id)->done)->toBeTrue();
    });

    it('OFF-21: a later delete beats an earlier edit, and the edit answers stale', function () {
        $id = newTask();

        expect(patches([
            ['entity' => 'task', 'id' => $id, 'field' => 'deleted', 'value' => true, 'at' => at(2)],
            ['entity' => 'task', 'id' => $id, 'field' => 'title', 'value' => 'Edited', 'at' => at(1)],
        ]))->toBe([
            ['index' => 0, 'status' => 'applied'],
            ['index' => 1, 'status' => 'stale', 'current' => 'Buy milk'],
        ]);
        expect(Task::find($id))->toBeNull();
    });

    it('OFF-21: a later restore beats an earlier delete', function () {
        $id = newTask();

        expect(patches([
            ['entity' => 'task', 'id' => $id, 'field' => 'deleted', 'value' => true, 'at' => at(1)],
            ['entity' => 'task', 'id' => $id, 'field' => 'deleted', 'value' => false, 'at' => at(3)],
            ['entity' => 'task', 'id' => $id, 'field' => 'deleted', 'value' => true, 'at' => at(2)],
        ]))->toBe([
            ['index' => 0, 'status' => 'applied'],
            ['index' => 1, 'status' => 'applied'],
            ['index' => 2, 'status' => 'stale', 'current' => false],
        ]);
        expect(Task::find($id))->not->toBeNull();
    });

    it('renames a project and deletes it, moving or deleting its tasks', function () {
        $moved = newProject('Moved');
        $gone = newProject('Gone');
        $a = newTask(['project_id' => $moved]);
        $b = newTask(['project_id' => $gone]);

        expect(patches([
            ['entity' => 'project', 'id' => $moved, 'field' => 'name', 'value' => 'Renamed', 'at' => at(1)],
            ['entity' => 'project', 'id' => $moved, 'field' => 'deleted', 'value' => 'move', 'at' => at(2)],
            ['entity' => 'project', 'id' => $gone, 'field' => 'deleted', 'value' => 'delete', 'at' => at(2)],
            ['entity' => 'project', 'id' => $gone, 'field' => 'owner', 'value' => 'x', 'at' => at(2)],
        ]))->toBe([
            ['index' => 0, 'status' => 'applied'],
            ['index' => 1, 'status' => 'applied'],
            ['index' => 2, 'status' => 'applied'],
            ['index' => 3, 'status' => 'rejected'],
        ]);

        expect(Project::find($moved))->name->toBe('Renamed')->deleted_at->not->toBeNull()
            ->and(Task::find($a)->project_id)->toBeNull()
            ->and(Task::find($b))->toBeNull();
    });

    it('an online project rename after an offline one keeps the later name', function () {
        $id = newProject();
        $this->clock->advance('+1 minute');
        $this->patchJson("/api/v1/projects/{$id}", ['name' => 'Online'])->assertOk();

        expect(patches([['entity' => 'project', 'id' => $id, 'field' => 'name', 'value' => 'Offline', 'at' => at(-1)]]))
            ->toBe([['index' => 0, 'status' => 'stale', 'current' => 'Online']]);
    });

    it('PERF-04: 100 queued edits apply in one batch within 10 s, in order', function () {
        $ids = array_map(fn () => newTask(), range(1, 10));
        $rows = [];
        foreach (range(0, 99) as $i) {
            $rows[] = ['entity' => 'task', 'id' => $ids[$i % 10], 'field' => 'title', 'value' => "Edit {$i}", 'at' => at(1 + intdiv($i, 10))];
        }

        $started = microtime(true);
        $results = patches($rows);

        expect(microtime(true) - $started)->toBeLessThan(10)
            ->and(array_unique(array_column($results, 'status')))->toBe(['applied'])
            ->and(Task::find($ids[0])->title)->toBe('Edit 90');
    });
});

it('stamps sync bookkeeping: change_seq moves on every write', function () {
    $id = newTask();
    $before = DB::table('tasks')->where('id', $id)->value('change_seq');
    patches([['entity' => 'task', 'id' => $id, 'field' => 'notes', 'value' => 'Two litres', 'at' => at(1)]]);

    expect(DB::table('tasks')->where('id', $id)->value('change_seq'))->toBeGreaterThan($before);
});
