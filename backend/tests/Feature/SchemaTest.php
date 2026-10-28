<?php

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// IM-03: rules the database enforces on its own (data-model.md)
uses(RefreshDatabase::class);

function insertTask(int $userId, array $overrides = []): string
{
    $id = (string) Str::uuid7();
    DB::table('tasks')->insert(array_merge(['id' => $id, 'user_id' => $userId, 'title' => 'SQL quiz'], $overrides));

    return $id;
}

function insertProject(int $userId, string $name, array $overrides = []): string
{
    $id = (string) Str::uuid7();
    DB::table('projects')->insert(array_merge(['id' => $id, 'user_id' => $userId, 'name' => $name, 'colour' => 'blue'], $overrides));

    return $id;
}

beforeEach(function () {
    $this->userId = User::factory()->create()->id;
});

it('T-TK-22: rejects an end time before or equal to the start time', function (string $end) {
    expect(fn () => insertTask($this->userId, ['start_time' => '10:00', 'end_time' => $end]))
        ->toThrow(QueryException::class, 'tasks_end_after_start');
})->with(['09:00', '10:00']);

it('allows a valid schedule, or either time on its own', function () {
    insertTask($this->userId, ['start_time' => '09:00', 'end_time' => '10:00']);
    insertTask($this->userId, ['start_time' => '09:00']);

    expect(DB::table('tasks')->count())->toBe(2);
});

it('rejects values outside each list', function (string $table, array $row, string $constraint) {
    $base = [
        'tasks' => fn () => insertTask($this->userId, $row),
        'projects' => fn () => insertProject($this->userId, 'HCI', $row),
        'notes' => fn () => DB::table('notes')->insert(array_merge([
            'id' => Str::uuid7(), 'user_id' => $this->userId, 'client_id' => Str::uuid(), 'text' => 'x',
            'status' => 'new', 'written_at' => now(), 'written_tz' => 'Asia/Ho_Chi_Minh',
        ], $row)),
    ];

    expect($base[$table])->toThrow(QueryException::class, $constraint);
})->with([
    'priority' => ['tasks', ['priority' => 'urgent'], 'tasks_priority'],
    'reminder' => ['tasks', ['reminder' => '2h'], 'tasks_reminder'],
    'repeat' => ['tasks', ['repeat' => 'hourly'], 'tasks_repeat'],
    'created_by' => ['tasks', ['created_by' => 'robot'], 'tasks_created_by'],
    'colour' => ['projects', ['colour' => 'pink'], 'projects_colour'],
    'status' => ['notes', ['status' => 'weird'], 'notes_status'],
    'engine' => ['notes', ['engine' => 'gpt'], 'notes_engine'],
]);

it('stores emails in lower case only', function () {
    expect(fn () => User::factory()->create(['email' => 'Example@Gmail.com']))
        ->toThrow(QueryException::class, 'users_email_lower');
});

it('bumps change_seq on every insert and update of synced rows', function () {
    $id = insertTask($this->userId);
    $first = DB::table('tasks')->where('id', $id)->value('change_seq');

    DB::table('tasks')->where('id', $id)->update(['done' => true]);

    expect($first)->toBeInt()
        ->and(DB::table('tasks')->where('id', $id)->value('change_seq'))->toBeGreaterThan($first);
});

it('keeps project names unique per user, ignoring case and deleted projects', function () {
    insertProject($this->userId, 'SQL Course', ['deleted_at' => now()]);
    insertProject($this->userId, 'SQL Course');
    insertProject(User::factory()->create()->id, 'SQL Course');

    expect(fn () => insertProject($this->userId, 'sql course'))
        ->toThrow(QueryException::class, 'projects_user_name_unique');
});

it('replays a note client_id only once per user', function () {
    $note = fn (int $userId) => DB::table('notes')->insert([
        'id' => Str::uuid7(), 'user_id' => $userId, 'client_id' => '6f1c2b3a-4d5e-4f7a-8b9c-0d1e2f3a4b01',
        'text' => 'sql quiz monday', 'status' => 'new', 'written_at' => now(), 'written_tz' => 'Asia/Ho_Chi_Minh',
    ]);

    $note(User::factory()->create()->id);
    $note($this->userId);

    expect(fn () => $note($this->userId))->toThrow(QueryException::class, 'notes_user_id_client_id_unique');
});

it('makes at most one next occurrence per completed repeating task', function () {
    $previous = insertTask($this->userId, ['repeat' => 'weekly']);
    insertTask($this->userId, ['repeat' => 'weekly', 'previous_occurrence_id' => $previous]);

    expect(fn () => insertTask($this->userId, ['repeat' => 'weekly', 'previous_occurrence_id' => $previous]))
        ->toThrow(QueryException::class, 'tasks_previous_occurrence_id_unique');
});

it('finds tasks without accents through the search index expression', function () {
    insertTask($this->userId, ['title' => 'Bài tập SQL', 'notes' => 'Nộp trước thứ Sáu']);

    $hits = fn (string $q) => DB::table('tasks')
        ->whereRaw("immutable_unaccent(title || ' ' || coalesce(notes, '')) ILIKE immutable_unaccent(?)", ["%{$q}%"])
        ->count();

    expect($hits('bai tap'))->toBe(1)->and($hits('nop truoc'))->toBe(1)->and($hits('lab report'))->toBe(0);
});
