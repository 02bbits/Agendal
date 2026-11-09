<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    config(['notes.engine_budget_ms' => 60_000]);
    $this->user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $this->actingAs($this->user);
});

function followupPayload(string $text): array
{
    return ['client_id' => (string) Str::uuid(), 'text' => $text, 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh'];
}

it('keeps the whole note as one task without extracting fields (T-RV-22)', function () {
    $text = "idea: sql quiz tomorrow 9am urgent\nfyi: gym every day";
    $note = $this->postJson('/api/v1/notes', followupPayload($text))->assertCreated()->assertJsonPath('note.status', 'followup');
    expect(Task::count())->toBe(0);
    $id = $note->json('note.id');
    // Keep it as task only plans the task: Check this first shows it and nothing is made until Apply.
    $this->postJson("/api/v1/notes/$id/make-task")->assertOk()->assertJsonPath('note.status', 'confirm')->assertJsonCount(1, 'changes')
        ->assertJsonPath('changes.0.kind', 'created')->assertJsonPath('changes.0.task.title', 'idea: sql quiz tomorrow 9am urgent fyi: gym every day');
    $this->postJson("/api/v1/notes/$id/make-task")->assertOk()->assertJsonPath('note.status', 'confirm');
    expect(Task::count())->toBe(0);
    $made = $this->postJson("/api/v1/notes/$id/apply")->assertOk()->assertJsonPath('note.status', 'done')->assertJsonCount(1, 'changes');
    $task = Task::firstOrFail();
    expect($task->title)->toBe('idea: sql quiz tomorrow 9am urgent fyi: gym every day')
        ->and([$task->due_date, $task->start_time, $task->due_time, $task->project_id])->toBe([null, null, null, null])
        ->and([$task->priority, $task->repeat, $task->reminder, $task->created_by])->toBe(['low', 'never', 'none', 'assistant'])
        ->and($task->source_note_id)->toBe($id)->and($made->json('note.text'))->toBe($text);
    $this->postJson("/api/v1/notes/$id/make-task")->assertStatus(409);
    expect(Task::count())->toBe(1)->and(Note::count())->toBe(1);
});

it('cuts a long manual title at a word boundary and preserves the overflow', function () {
    $text = 'idea: '.str_repeat('portfolio research ', 25).'end';
    $id = $this->postJson('/api/v1/notes', followupPayload($text))->json('note.id');
    $this->postJson("/api/v1/notes/$id/make-task")->assertOk();
    $this->postJson("/api/v1/notes/$id/apply")->assertOk();
    $task = Task::firstOrFail();
    expect(mb_strlen($task->title))->toBeLessThanOrEqual(200)
        ->and($task->title.' '.$task->notes)->toBe($text);
});

it('records the manual task for Undo and Redo', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('idea: a little garden'))->json('note.id');
    $this->postJson("/api/v1/notes/$id/make-task")->assertOk();
    $this->postJson("/api/v1/notes/$id/apply")->assertOk();
    $taskId = Task::firstOrFail()->id;
    expect(Note::findOrFail($id)->applied)->toHaveCount(1);
    $this->postJson("/api/v1/notes/$id/undo")->assertOk()->assertJsonPath('note.status', 'pending');
    expect(Task::find($taskId))->toBeNull();
    $this->postJson("/api/v1/notes/$id/redo")->assertOk()->assertJsonPath('note.status', 'done');
    expect(Task::find($taskId))->not->toBeNull()->and(Task::count())->toBe(1);
});

it('only lets the owner resolve or edit the note', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('ok thanks'))->json('note.id');
    $this->actingAs(User::factory()->create());
    $this->postJson("/api/v1/notes/$id/make-task")->assertNotFound();
    $this->putJson("/api/v1/notes/$id", ['text' => 'read tomorrow', 'timezone' => 'UTC'])->assertNotFound();
    $this->actingAs($this->user);
    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('followup');
});

it('replans the same note at edit time and applies the current confirmation contract (T-RV-23)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->user->id, 'title' => 'Gym', 'due_date' => '2026-10-23'])->save();
    $original = followupPayload('idea: gym');
    $id = $this->postJson('/api/v1/notes', $original)->json('note.id');
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-24T08:12:00+07:00'));
    $input = ['text' => 'move gym to tomorrow', 'timezone' => 'Asia/Ho_Chi_Minh', 'written_at' => '2000-01-01T00:00:00Z'];
    $edited = $this->putJson("/api/v1/notes/$id", $input)->assertOk()->assertJsonPath('note.id', $id)
        ->assertJsonPath('note.client_id', $original['client_id'])->assertJsonPath('note.status', 'confirm')
        ->assertJsonPath('changes.0.task.due_date', '2026-10-25');
    expect(Note::count())->toBe(1)->and($task->fresh()->due_date)->toBe('2026-10-23')
        ->and($edited->json('note.edited_at'))->not->toBeNull();
    $this->postJson("/api/v1/notes/$id/apply")->assertOk()->assertJsonPath('note.status', 'done');
    expect($task->fresh()->due_date)->toBe('2026-10-25');
    $this->putJson("/api/v1/notes/$id", $input)->assertOk()->assertJsonPath('note.status', 'done');
    expect(Task::count())->toBe(1);
});

it('leaves unchanged text alone and can remain a follow-up after an edit', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('idea: garden'))->json('note.id');
    $this->putJson("/api/v1/notes/$id", ['text' => 'idea: garden', 'timezone' => 'UTC'])->assertOk()->assertJsonPath('note.edited_at', null);
    $this->putJson("/api/v1/notes/$id", ['text' => 'idea: a bigger garden', 'timezone' => 'UTC'])->assertOk()->assertJsonPath('note.status', 'followup');
    expect(Task::count())->toBe(0)->and(Note::count())->toBe(1);
    $this->postJson("/api/v1/notes/$id/make-task")->assertOk()->assertJsonPath('changes.0.task.title', 'idea: a bigger garden');
});

it('rolls back a failed replan without replacing the original note', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('idea: garden'))->json('note.id');
    $this->putJson("/api/v1/notes/$id", ['text' => implode("\n", array_fill(0, 31, 'read')), 'timezone' => 'UTC'])->assertStatus(422);
    expect(Note::findOrFail($id)->text)->toBe('idea: garden')->and(Note::findOrFail($id)->status)->toBe('followup')
        ->and(Note::findOrFail($id)->edited_at)->toBeNull()->and(Task::count())->toBe(0);
});

it('rejects make-task on a confirm note instead of bypassing Apply', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('read tomorrow'))->json('note.id');
    $this->postJson("/api/v1/notes/$id/make-task")->assertStatus(409);
    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('confirm');
});

it('keeps the task limit atomic when resolving a follow-up', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('idea: garden'))->json('note.id');
    $rows = array_map(fn (int $i): array => ['id' => (string) Str::uuid7(), 'user_id' => $this->user->id, 'title' => 'Existing '.$i], range(1, Task::OPEN_LIMIT));
    DB::table('tasks')->insert($rows);
    $this->postJson("/api/v1/notes/$id/make-task")->assertStatus(422);
    expect(Task::count())->toBe(Task::OPEN_LIMIT)->and(Note::findOrFail($id)->status)->toBe('followup')
        ->and(Note::findOrFail($id)->applied)->toBe([]);
});

it('rolls back all writes when manual task creation fails', function () {
    $id = $this->postJson('/api/v1/notes', followupPayload('idea: garden'))->json('note.id');
    Event::listen('eloquent.created: '.Task::class, fn () => throw new RuntimeException('write failed'));
    $this->withoutExceptionHandling();
    expect(fn () => $this->postJson("/api/v1/notes/$id/make-task"))->toThrow(RuntimeException::class, 'write failed');
    expect(Task::count())->toBe(0)->and(Note::findOrFail($id)->status)->toBe('followup');
});
