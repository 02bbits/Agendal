<?php

use App\Models\Note;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use App\Services\Notes\NoteApplier;
use App\Services\Notes\NoteContext;
use App\Services\Notes\TaskCandidates;
use App\Services\Tasks\TaskRecurrence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    $this->owner = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
});

function edgeNote(string $text, string $writtenAt = '2026-10-23T08:12:00+07:00'): array
{
    return ['client_id' => (string) Str::uuid(), 'text' => $text, 'written_at' => $writtenAt, 'timezone' => 'Asia/Ho_Chi_Minh'];
}

it('applies consecutive notes within the same clock tick', function () {
    $this->actingAs($this->owner)->postJson('/api/v1/notes', edgeNote('call mum tomorrow'))->assertCreated();
    $this->postJson('/api/v1/notes', edgeNote('done call mum'))->assertCreated();
    expect(Task::firstOrFail()->done)->toBeTrue();
});

it('preserves and shifts a task’s duration (T-NU-135)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->owner->id, 'title' => 'Email group', 'due_date' => '2026-10-23', 'start_time' => '09:00', 'end_time' => '10:00'])->save();
    $this->actingAs($this->owner)->postJson('/api/v1/notes', edgeNote('move email group to sunday'))->assertCreated();
    expect($task->fresh()->start_time)->toBe('09:00:00')->and($task->fresh()->end_time)->toBe('10:00:00');
    $this->postJson('/api/v1/notes', edgeNote('move email group to tomorrow 2pm'))->assertCreated();
    expect($task->fresh()->start_time)->toBe('14:00:00')->and($task->fresh()->end_time)->toBe('15:00:00');
});

it('creates one next occurrence and records it for undo (T-NU-136)', function (string $repeat, string $due, string $anchor, string $now, string $expected) {
    app()->instance(ClockInterface::class, new FrozenClock($now));
    $task = new Task;
    $task->forceFill(['user_id' => $this->owner->id, 'title' => 'Call mum', 'due_date' => $due, 'repeat' => $repeat, 'repeat_anchor' => $anchor])->save();
    $payload = edgeNote('done call mum', $now);
    $this->actingAs($this->owner)->postJson('/api/v1/notes', $payload)->assertCreated()->assertJsonCount(2, 'changes');
    $next = Task::where('previous_occurrence_id', $task->id)->firstOrFail();
    expect($next->due_date)->toBe($expected)->and($next->done)->toBeFalse()->and($next->repeat_anchor)->toBe($anchor);
    expect(app(TaskRecurrence::class)->next($task->fresh())->id)->toBe($next->id);
    $this->postJson('/api/v1/notes', $payload)->assertOk();
    expect(Task::count())->toBe(2)->and(Note::firstOrFail()->applied)->toHaveCount(2);
})->with([
    ['daily', '2026-10-20', '2026-10-20', '2026-10-23T08:12:00+07:00', '2026-10-23'],
    ['weekly', '2026-10-23', '2026-10-23', '2026-10-20T08:12:00+07:00', '2026-10-30'],
    ['monthly', '2026-01-31', '2026-01-31', '2026-01-31T08:12:00+07:00', '2026-02-28'],
    ['monthly', '2026-02-28', '2026-01-31', '2026-02-28T08:12:00+07:00', '2026-03-31'],
    ['yearly', '2024-02-29', '2024-02-29', '2024-02-29T08:12:00+07:00', '2025-02-28'],
]);

it('revalidates deleted and changed confirmation targets under row locks (T-NU-138)', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->owner->id, 'title' => 'Email group', 'due_date' => '2026-10-23', 'start_time' => '09:00', 'end_time' => '10:00'])->save();
    $text = 'move email group to sunday; buy milk; buy eggs; buy bread; buy rice; buy tea';
    $this->actingAs($this->owner)->postJson('/api/v1/notes', edgeNote($text))->assertCreated()->assertJsonPath('note.status', 'confirm');
    $note = Note::firstOrFail();
    $task->forceFill(['due_date' => '2026-10-24', 'start_time' => '14:00', 'end_time' => '16:00'])->save();
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $applied = DB::transaction(fn () => app(NoteApplier::class)->apply($note, $note->plan, $context));
    expect($applied['changes'][5]['label'])->toBe('Due Sun 25 Oct (was tomorrow)');
    expect($task->fresh()->start_time)->toBe('14:00:00')->and($task->fresh()->end_time)->toBe('16:00:00');
    $task->delete();
    $deletePlan = ['create' => [], 'update' => [], 'delete' => [['ref' => 'd1', 'task_id' => $task->id, 'label' => 'Email group']], 'skipped' => [], 'ambiguous' => []];
    $deleted = DB::transaction(fn () => app(NoteApplier::class)->apply($note, $deletePlan, $context));
    expect($deleted['changes'])->toBe([])->and($deleted['skipped'][0]['reason'])->toBe('not_found');
});

it('soft deletes approved entries and preserves their before values', function () {
    $task = new Task;
    $task->forceFill(['user_id' => $this->owner->id, 'title' => 'Old reading list'])->save();
    $this->actingAs($this->owner)->postJson('/api/v1/notes', edgeNote('delete old reading list'))->assertCreated();
    $note = Note::firstOrFail();
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $applied = DB::transaction(fn () => app(NoteApplier::class)->apply($note, $note->plan, $context));
    expect($applied['applied'][0]['before']['title'])->toBe('Old reading list')->and($task->fresh()->trashed())->toBeTrue();
});

it('rejects the open-task limit atomically', function () {
    $rows = array_map(fn (int $i): array => ['id' => (string) Str::uuid7(), 'user_id' => $this->owner->id, 'title' => 'Existing '.$i], range(1, Task::OPEN_LIMIT));
    DB::table('tasks')->insert($rows);
    $this->actingAs($this->owner)->postJson('/api/v1/notes', edgeNote('call mum'))->assertUnprocessable();
    expect(Note::count())->toBe(0)->and(Task::count())->toBe(Task::OPEN_LIMIT);
});

it('keeps markup as text (T-NU-139)', function () {
    $text = '<script>alert(1)</script>';
    $this->actingAs($this->owner)->postJson('/api/v1/notes', edgeNote($text))->assertCreated()->assertJsonPath('note.text', $text);
    expect(Note::firstOrFail()->text)->toBe($text);
    expect(app(TaskCandidates::class)->find($this->owner->id, []))->toBe([]);
    expect(app(TaskRecurrence::class)->next(Task::firstOrFail()))->toBeNull();
});
