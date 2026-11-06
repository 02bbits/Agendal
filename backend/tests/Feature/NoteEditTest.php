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
    $this->user = User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
    $this->actingAs($this->user);
});

function createDoneNote(string $text): array
{
    $res = test()->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(),
        'text' => $text,
        'written_at' => '2026-10-23T08:12:00+07:00',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->json();

    if ($res['note']['status'] === 'confirm') {
        return test()->postJson("/api/v1/notes/{$res['note']['id']}/apply")->assertOk()->json();
    }

    return $res;
}

it('undoes the old plan and plans the new text under safety rules (T-RV-61, RV-5)', function () {
    $res = createDoneNote('call mum tomorrow; read report');
    $id = $res['note']['id'];
    expect(Task::count())->toBe(2);

    // Fast-forward clock to edit time
    $this->clock->setTime('2026-10-23T10:30:00+07:00');

    // Note: since changes_to_confirm default is 1, set to 5 so 1 new task goes to done
    config(['notes.changes_to_confirm' => 5]);

    $edited = $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'buy milk Friday',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertOk();

    expect($edited->json('note.status'))->toBe('done')
        ->and($edited->json('note.edited_at'))->toBe($this->clock->now()->format(DATE_ATOM))
        ->and(Task::count())->toBe(1)
        ->and(Task::first()->title)->toBe('Buy milk');

    // The 2 old tasks are soft-deleted/removed
    expect(Task::onlyTrashed()->count())->toBe(2);
});

it('sends a new plan with a delete or destructive action to confirm (T-RV-62, RV-5)', function () {
    config(['notes.changes_to_confirm' => 5]);
    $existingTask = new Task;
    $existingTask->forceFill([
        'user_id' => $this->user->id,
        'title' => 'Pay electricity bill',
        'due_date' => '2026-10-25',
    ])->save();

    $res = createDoneNote('buy water tomorrow');
    $id = $res['note']['id'];
    expect(Task::count())->toBe(2); // existing + buy water

    $this->clock->setTime('2026-10-23T11:00:00+07:00');

    $edited = $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'xóa Pay electricity bill',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertOk();

    // Because the new plan contains a deletion, safety rules force status to 'confirm'
    expect($edited->json('note.status'))->toBe('confirm')
        ->and($edited->json('note.edited_at'))->toBe($this->clock->now()->format(DATE_ATOM));

    // The old note's applied tasks were undone
    expect(Task::withTrashed()->where('title', 'Buy water')->first()->deleted_at)->not->toBeNull();
    // The target task is not deleted yet because confirm has not been applied!
    expect($existingTask->fresh()->deleted_at)->toBeNull();
});

it('changes nothing when a failure hits mid-edit (T-RV-63, NF-11)', function () {
    $res = createDoneNote('call client tomorrow');
    $id = $res['note']['id'];
    $task = Task::first();
    expect($task->title)->toBe('Call client');

    $this->clock->setTime('2026-10-23T11:30:00+07:00');

    Task::saving(function () {
        throw new RuntimeException('boom mid-edit');
    });

    $this->withoutExceptionHandling();
    expect(fn () => $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'buy milk Friday',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ]))->toThrow(RuntimeException::class);

    // Atomicity check: nothing changed! Old task is still alive, note is still original
    expect(Task::count())->toBe(1)
        ->and(Task::first()->id)->toBe($task->id)
        ->and(Note::findOrFail($id)->edited_at)->toBeNull()
        ->and(Note::findOrFail($id)->text)->toBe('call client tomorrow');
});

it('lists the note with edited_at in GET /notes (T-RV-64, RV-4)', function () {
    config(['notes.changes_to_confirm' => 5]);
    $res = createDoneNote('clean room');
    $id = $res['note']['id'];

    $this->clock->setTime('2026-10-23T12:00:00+07:00');
    $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'paint room',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertOk();

    $list = $this->getJson('/api/v1/notes')->assertOk();
    $item = collect($list->json('items'))->firstWhere('id', $id);

    expect($item)->not->toBeNull()
        ->and($item['edited_at'])->toBe($this->clock->now()->format(DATE_ATOM));
});

it('rejects editing a done note past the 30-day window (RV-E17)', function () {
    $res = createDoneNote('prepare presentation');
    $id = $res['note']['id'];

    // Advance 31 days
    $this->clock->setTime('2026-11-25T08:12:00+07:00');

    $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'update presentation',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertStatus(409)->assertJsonPath('error.code', 'note.undo_expired');
});

it('detects edited tasks and requires confirm_conflicts (RV-E16)', function () {
    $res = createDoneNote('write newsletter tomorrow');
    $id = $res['note']['id'];
    $task = Task::first();

    // User edits task manually
    $task->forceFill(['title' => 'Write newsletter on Substack'])->save();

    // Edit note without confirm_conflicts -> 409
    $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'write email blast',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertStatus(409)->assertJsonPath('error.code', 'note.undo_conflicts');

    // Edit note with confirm_conflicts = true -> succeeds
    config(['notes.changes_to_confirm' => 5]);
    $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'write email blast',
        'timezone' => 'Asia/Ho_Chi_Minh',
        'confirm_conflicts' => true,
    ])->assertOk();

    expect(Task::where('title', 'Write email blast')->count())->toBe(1);
});

it('returns current note unchanged when text is unchanged (RV-E18)', function () {
    $res = createDoneNote('study biology');
    $id = $res['note']['id'];

    $this->clock->setTime('2026-10-23T13:00:00+07:00');
    $this->putJson("/api/v1/notes/{$id}", [
        'text' => 'study biology',
        'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertOk();

    expect(Note::findOrFail($id)->edited_at)->toBeNull();
});
