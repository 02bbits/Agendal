<?php

declare(strict_types=1);

use App\Models\Note;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\Clock\ClockInterface;
use Database\Factories\NoteFactory;
use Database\Factories\TaskFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Tests\Support\FrozenClock;

// #194: a factory row is one the API could have made, so tests and the demo seed start from real data
uses(RefreshDatabase::class);

beforeEach(function () {
    app()->instance(ClockInterface::class, new FrozenClock('2026-10-23T08:12:00+07:00'));
    $this->owner = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
});

it('makes a task POST /tasks accepts, with the server-set fields it would set', function (Closure $state) {
    /** @var TaskFactory $factory */
    $factory = $state(Task::factory()->state(['user_id' => $this->owner->id]));
    $made = $factory->create();

    $id = (string) Str::uuid7();
    $sent = Arr::only($made->attributesToArray(), array_diff(Task::PATCHABLE, ['project_order', 'day_order']));
    $this->actingAs($this->owner)->postJson('/api/v1/tasks', ['id' => $id, ...$sent])->assertCreated();
    $api = Task::findOrFail($id);

    foreach (['start_date', 'due_date', 'remind_at', 'repeat_anchor'] as $field) {
        expect((string) $made->fresh()->{$field})->toBe((string) $api->{$field}, $field);
    }
    expect(array_keys($made->field_updated_at))->toEqualCanonicalizing(array_keys($api->field_updated_at))
        ->and($made->created_by)->toBe('user');
    if ($made->project_id !== null) {
        expect(Project::findOrFail($made->project_id)->user_id)->toBe($this->owner->id);
    }
})->with([
    'default' => fn (TaskFactory $f) => $f,
    'done' => fn (TaskFactory $f) => $f->done(),
    'due today' => fn (TaskFactory $f) => $f->dueToday(),
    'overdue' => fn (TaskFactory $f) => $f->overdue(3),
    'repeating, no date' => fn (TaskFactory $f) => $f->repeating('weekly'),
    'repeating, due' => fn (TaskFactory $f) => $f->dueIn(2)->repeating(),
    'in a project' => fn (TaskFactory $f) => $f->inProject(),
    'times and a reminder' => fn (TaskFactory $f) => $f->dueToday()
        ->state(['start_date' => fn (array $a) => $a['due_date'], 'start_time' => '14:00', 'due_time' => '15:30', 'reminder' => '15m']),
]);

it('marks a done task done at the clock time', function () {
    $task = Task::factory()->done()->create(['user_id' => $this->owner->id]);

    expect($task->done)->toBeTrue()
        ->and($task->done_at->format(DATE_ATOM))->toBe(app(ClockInterface::class)->now()->format(DATE_ATOM));
});

it('makes a note in the status the API gives its text', function (Closure $state, string $status, array $steps) {
    /** @var NoteFactory $factory */
    $factory = $state(Note::factory()->state(['user_id' => $this->owner->id]));
    $made = $factory->create()->refresh();

    $this->actingAs($this->owner);
    $id = $this->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => $made->text,
        'written_at' => $made->written_at->format(DATE_ATOM), 'timezone' => $made->written_tz,
    ])->assertCreated()->json('note.id');
    foreach ($steps as $step) {
        $this->postJson("/api/v1/notes/{$id}/{$step}")->assertOk();
    }
    $api = Note::findOrFail($id);

    expect($made->status)->toBe($status)
        ->and($api->status)->toBe($status)
        ->and($made->name)->toBe($api->name)
        ->and($made->plan['create'])->toEqual($api->plan['create'])
        ->and(count($made->applied))->toBe(count($api->applied));
    if ($status === 'done') {
        expect(Task::where('source_note_id', $made->id)->value('title'))->toBe($api->plan['create'][0]['title']);
    }
})->with([
    'followup' => [fn (NoteFactory $f) => $f->followup(), 'followup', []],
    'confirm' => [fn (NoteFactory $f) => $f->confirm(), 'confirm', ['make-task']],
    'done' => [fn (NoteFactory $f) => $f->done(), 'done', ['make-task', 'apply']],
]);
