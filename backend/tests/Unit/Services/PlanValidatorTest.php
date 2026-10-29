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

it('requires confirmation for deletes, ties and six changes (T-NU-40–43)', function (array $plan, PlanStatus $status) {
    expect(app(PlanValidator::class)->status(array_replace(emptyNotePlan(), $plan)))->toBe($status);
})->with([
    '5 creates → done' => [['create' => array_fill(0, 5, [])], PlanStatus::Done],
    '6 creates → confirm' => [['create' => array_fill(0, 6, [])], PlanStatus::Confirm],
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
})->with(['empty' => [''], 'spaces' => ['   '], 'too long' => [str_repeat('a', 201)]]);

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

    expect(app(PlanValidator::class)->validate($plan, [], $tasks)['ambiguous'] !== [])->toBe($kept);
})->with([
    'valid' => [['ref' => 'u1', 'candidates' => [0, 1], 'preselected' => 0], true],
    'one candidate' => [['ref' => 'u1', 'candidates' => [0], 'preselected' => 0], false],
    'six candidates' => [['ref' => 'u1', 'candidates' => [0, 1, 2, 3, 4, 5], 'preselected' => 0], false],
    'preselected outside' => [['ref' => 'u1', 'candidates' => [0, 1], 'preselected' => 2], false],
    'no kept change' => [['ref' => 'u9', 'candidates' => [0, 1], 'preselected' => 0], false],
]);
