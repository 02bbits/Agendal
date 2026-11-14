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
    config(['notes.engine_budget_ms' => 60_000]);
    $this->actingAs(User::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']));
});

/** A note in the given status, reached the way the app reaches it; `pending` is one whose redo has lapsed. */
function noteInStatus(string $status): string
{
    $text = $status === 'followup' ? "idea: sql quiz tomorrow 9am urgent\nfyi: gym every day" : 'call mum tomorrow';
    $id = test()->postJson('/api/v1/notes', [
        'client_id' => (string) Str::uuid(), 'text' => $text, 'written_at' => '2026-10-23T08:12:00+07:00', 'timezone' => 'Asia/Ho_Chi_Minh',
    ])->assertCreated()->json('note.id');
    if (in_array($status, ['done', 'pending', 'new'], true)) {
        test()->postJson("/api/v1/notes/{$id}/apply")->assertOk();
    }
    match ($status) {
        'pending' => Note::query()->whereKey($id)->update(['status' => 'pending', 'undo_log' => null]),
        'new' => Note::query()->whereKey($id)->update(['status' => 'new']),
        default => null,
    };
    expect(Note::findOrFail($id)->status)->toBe($status);

    return $id;
}

it('refuses every action the note\'s status does not allow, changing nothing (T-RV-50)', function (string $status, string $method, string $action) {
    $id = noteInStatus($status);
    $before = Note::findOrFail($id)->only(['status', 'plan', 'applied', 'plan_version']);
    $body = $method === 'put' ? ['text' => 'call dad friday', 'timezone' => 'Asia/Ho_Chi_Minh'] : [];

    $this->json($method, "/api/v1/notes/{$id}{$action}", $body)
        ->assertStatus(409)->assertJsonPath('error.code', 'note.wrong_status');
    expect(Note::findOrFail($id)->only(['status', 'plan', 'applied', 'plan_version']))->toEqual($before);
})->with([
    'apply on done' => ['done', 'post', '/apply'],
    'apply on followup' => ['followup', 'post', '/apply'],
    'apply on pending' => ['pending', 'post', '/apply'],
    'make-task on done' => ['done', 'post', '/make-task'],
    'make-task on confirm' => ['confirm', 'post', '/make-task'],
    'make-task on pending' => ['pending', 'post', '/make-task'],
    'undo on confirm' => ['confirm', 'post', '/undo'],
    'undo on followup' => ['followup', 'post', '/undo'],
    'undo on pending without its log' => ['pending', 'post', '/undo'],
    'redo on confirm' => ['confirm', 'post', '/redo'],
    'redo on followup' => ['followup', 'post', '/redo'],
    'edit while new' => ['new', 'put', ''],
]);
