<?php

use App\Enums\PlanStatus;
use App\Services\Notes\PlanValidator;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class);

function emptyNotePlan(): array
{
    return ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
}

function newTaskEntry(array $fields = []): array
{
    return [...['ref' => 'c1', 'title' => 'Call mum', 'due_date' => null, 'start_time' => null, 'end_time' => null, 'priority' => 'low', 'project_id' => null, 'repeat' => 'never', 'reminder' => 'none', 'notes' => null, 'duplicate_of' => null], ...$fields];
}

it('requires confirmation for deletes, ties and five changes (T-NU-40–43)', function (array $plan, PlanStatus $status) {
    expect(app(PlanValidator::class)->status(array_replace(emptyNotePlan(), $plan)))->toBe($status);
})->with([
    '4 creates → done' => [['create' => array_fill(0, 4, [])], PlanStatus::Done],
    '5 creates → confirm' => [['create' => array_fill(0, 5, [])], PlanStatus::Confirm],
    'a task changed twice counts once' => [['create' => array_fill(0, 3, []), 'update' => [['task_id' => 't1'], ['task_id' => 't1']]], PlanStatus::Done],
    'a delete → confirm' => [['delete' => [[]]], PlanStatus::Confirm],
    'a tie → confirm' => [['ambiguous' => [[]]], PlanStatus::Confirm],
    'a plain skip → followup' => [['skipped' => [['ref' => 's1', 'text' => 'ok', 'reason' => 'skip']]], PlanStatus::Followup],
    'only unmatched commands → done' => [['skipped' => [['ref' => 's1', 'text' => 'done x', 'reason' => 'not_found']]], PlanStatus::Done],
    'a plain skip among unmatched → followup' => [['skipped' => [['ref' => 's1', 'text' => 'done x', 'reason' => 'already_done'], ['ref' => 's2', 'text' => 'hmm', 'reason' => 'skip']]], PlanStatus::Followup],
]);

it('rejects foreign IDs even when the allowed set is empty (T-NU-71, SEC-41)', function () {
    $id = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['update' => [['ref' => 'u1', 'task_id' => $id, 'label' => 'Completed', 'done' => true]], 'delete' => [['ref' => 'd1', 'task_id' => $id, 'label' => 'Delete']]]);
    $result = app(PlanValidator::class)->validate($plan, [], []);

    expect([$result['dropped'], $result['update'], $result['delete']])->toBe([2, [], []]);
});

it('validates real dates, enums, update fields and merged time ranges', function () {
    $id = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['update' => [
        ['ref' => 'u1', 'task_id' => $id, 'label' => 'Move', 'due_date' => '2026-02-31'],
        ['ref' => 'u2', 'task_id' => $id, 'label' => 'Move', 'priority' => 'critical'],
        ['ref' => 'u3', 'task_id' => $id, 'label' => 'Move', 'end_time' => '08:00'],
        ['ref' => 'u4', 'task_id' => $id, 'label' => 'Completed', 'done' => true],
        ['ref' => 'u5', 'task_id' => $id, 'label' => 'Nothing changes'],
    ]]);
    $result = app(PlanValidator::class)->validate($plan, [], [$id => ['start_time' => '09:00', 'end_time' => '10:00']]);

    expect([$result['dropped'], array_column($result['update'], 'ref')])->toBe([4, ['u4']]);
});

it('rejects a timed, repeating or reminded create without a date (NU-E5)', function (array $fields) {
    $plan = array_replace(emptyNotePlan(), ['create' => [newTaskEntry($fields)]]);

    expect(app(PlanValidator::class)->validate($plan, [], [])['dropped'])->toBe(1);
})->with([
    'time' => [['start_time' => '09:00']],
    'repeat' => [['repeat' => 'weekly']],
    'reminder' => [['reminder' => '15m']],
]);

it('rejects titles with nothing to read or over 200 characters (NU §8)', function (string $title) {
    $plan = array_replace(emptyNotePlan(), ['create' => [newTaskEntry(['title' => $title])]]);

    expect(app(PlanValidator::class)->validate($plan, [], [])['dropped'])->toBe(1);
})->with(['empty' => [''], 'spaces' => ['   '], 'invisible' => ["\u{200B}\u{00A0}"], 'too long' => [str_repeat('a', 201)]]);

it('keeps a date on a task an update schedules (NU-E5)', function (array $task, array $fields) {
    $id = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['update' => [['ref' => 'u1', 'task_id' => $id, 'label' => 'Move', ...$fields]]]);

    expect(app(PlanValidator::class)->validate($plan, [], [$id => $task])['dropped'])->toBe(1);
})->with([
    'a time on an undated task' => [['due_date' => null], ['start_time' => '09:00']],
    'clearing the date of a timed, repeating task' => [['due_date' => '2026-10-26', 'start_time' => '09:00', 'repeat' => 'weekly', 'reminder' => '15m'], ['due_date' => null]],
]);

it('checks entries for one task on the task as the earlier ones leave it', function () {
    $id = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['update' => [
        ['ref' => 'u1', 'task_id' => $id, 'label' => 'Move', 'start_time' => '10:00'],
        ['ref' => 'u2', 'task_id' => $id, 'label' => 'Move', 'end_time' => '09:30'],
    ]]);
    $result = app(PlanValidator::class)->validate($plan, [], [$id => ['due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '17:00']]);

    expect(array_column($result['update'], 'ref'))->toBe(['u1']);
});

it('asks when two entries set a field of one task to different values', function () {
    $id = (string) Str::uuid();
    $validator = app(PlanValidator::class);
    $result = $validator->validate(array_replace(emptyNotePlan(), ['update' => [
        ['ref' => 'u1', 'task_id' => $id, 'label' => 'Move', 'due_date' => '2026-10-27'],
        ['ref' => 'u2', 'task_id' => $id, 'label' => 'Move', 'due_date' => '2026-10-28'],
    ]]), [], [$id => ['due_date' => '2026-10-26']]);

    expect([count($result['update']), $validator->status($result)])->toBe([2, PlanStatus::Confirm]);
});

it('drops parts that are not lists and a second entry with the same ref', function () {
    $id = (string) Str::uuid();
    $plan = [...emptyNotePlan(), 'create' => 'oops', 'update' => [['ref' => 'u1', 'task_id' => $id, 'label' => 'Completed', 'done' => true]], 'delete' => [['ref' => 'u1', 'task_id' => $id, 'label' => 'Delete']]];
    $result = app(PlanValidator::class)->validate($plan, [], [$id => []]);

    expect([$result['dropped'], count($result['update']), $result['delete']])->toBe([2, 1, []]);
});

it('keeps a skip reason it knows, without extra fields, and makes an unknown one a plain skip (BR-02)', function () {
    $validator = app(PlanValidator::class);
    $result = $validator->validate(array_replace(emptyNotePlan(), ['skipped' => [
        ['ref' => 's1', 'text' => 'done x', 'reason' => 'not_found', 'extra' => 1],
        ['ref' => 's2', 'text' => 'call the bank', 'reason' => 'weird'],
    ]]), [], []);

    expect([$result['skipped'], $validator->status($result)])->toBe([[['ref' => 's1', 'text' => 'done x', 'reason' => 'not_found'], ['ref' => 's2', 'text' => 'call the bank', 'reason' => 'skip']], PlanStatus::Followup]);
});

it('makes the very same task once when a note asks for it twice', function () {
    $plan = array_replace(emptyNotePlan(), ['create' => [newTaskEntry(), newTaskEntry(['ref' => 'c2']), newTaskEntry(['ref' => 'c3', 'start_time' => '09:00', 'due_date' => '2026-10-26'])]]);
    $result = app(PlanValidator::class)->validate($plan, [], []);

    expect([$result['dropped'], array_column($result['create'], 'ref')])->toBe([1, ['c1', 'c3']]);
});

it('keeps a valid create and drops an unknown project', function () {
    $project = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['create' => [newTaskEntry(['project_id' => $project]), newTaskEntry(['ref' => 'c2', 'project_id' => (string) Str::uuid()])]]);
    $result = app(PlanValidator::class)->validate($plan, [$project => 'Personal'], []);

    expect([$result['dropped'], array_column($result['create'], 'ref')])->toBe([1, ['c1']]);
});

it('keeps only ties of a kept change with 2 to 5 owned candidates and one preselected (NU-E11)', function (array $tie, bool $kept) {
    $ids = array_map(fn (): string => (string) Str::uuid(), range(1, 6));
    $tasks = array_fill_keys($ids, ['title' => 'Call mum']);
    $tie = array_map(fn (mixed $value): mixed => is_int($value) ? $ids[$value] : (is_array($value) ? array_map(fn (int $i): string => $ids[$i], $value) : $value), $tie);
    $plan = array_replace(emptyNotePlan(), [
        'update' => [['ref' => 'u1', 'task_id' => $ids[0], 'label' => 'Completed', 'done' => true]],
        'ambiguous' => [$tie],
    ]);

    $validator = app(PlanValidator::class);
    $result = $validator->validate($plan, [], $tasks);

    // A broken tie drops, but its change still waits for Apply changes.
    expect([$result['ambiguous'] !== [], count($result['update']), $validator->status($result)])->toBe([$kept, 1, PlanStatus::Confirm]);
})->with([
    'valid' => [['ref' => 'u1', 'candidates' => [0, 1], 'preselected' => 0], true],
    'one candidate' => [['ref' => 'u1', 'candidates' => [0], 'preselected' => 0], false],
    'six candidates' => [['ref' => 'u1', 'candidates' => [0, 1, 2, 3, 4, 5], 'preselected' => 0], false],
    'preselected outside' => [['ref' => 'u1', 'candidates' => [0, 1], 'preselected' => 2], false],
    'preselected is not the changed task' => [['ref' => 'u1', 'candidates' => [0, 1], 'preselected' => 1], false],
    'changed task not offered' => [['ref' => 'u1', 'candidates' => [1, 2], 'preselected' => 1], false],
    'a repeated candidate drops, leaving one' => [['ref' => 'u1', 'candidates' => [0, 0], 'preselected' => 0], false],
]);

it('drops a tie whose change was dropped, with nothing left to confirm', function () {
    $ids = [(string) Str::uuid(), (string) Str::uuid()];
    $plan = array_replace(emptyNotePlan(), ['ambiguous' => [['ref' => 'u9', 'candidates' => $ids, 'preselected' => $ids[0]]]]);
    $result = app(PlanValidator::class)->validate($plan, [], array_fill_keys($ids, []));

    expect([$result['dropped'], $result['needs_confirm']])->toBe([1, false]);
});

it('keeps the confirm step when a validated plan is validated again (NU-E38)', function () {
    $id = (string) Str::uuid();
    $validator = app(PlanValidator::class);
    $plan = array_replace(emptyNotePlan(), [
        'update' => [['ref' => 'u1', 'task_id' => $id, 'label' => 'Completed', 'done' => true]],
        'ambiguous' => [['ref' => 'u1', 'candidates' => [$id], 'preselected' => $id]],
    ]);
    $again = $validator->validate($validator->validate($plan, [], [$id => []]), [], [$id => []]);

    expect($validator->status($again))->toBe(PlanStatus::Confirm);
});
