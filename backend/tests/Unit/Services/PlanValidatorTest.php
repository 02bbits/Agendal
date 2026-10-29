<?php

use App\Services\Notes\PlanValidator;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class);

function emptyNotePlan(): array
{
    return ['create' => [], 'update' => [], 'delete' => [], 'skipped' => [], 'ambiguous' => []];
}

it('requires confirmation for deletes, ties and six changes (T-NU-40–43)', function () {
    $validator = app(PlanValidator::class);
    expect($validator->status(array_replace(emptyNotePlan(), ['create' => array_fill(0, 5, [])])))->toBe('done');
    expect($validator->status(array_replace(emptyNotePlan(), ['create' => array_fill(0, 6, [])])))->toBe('confirm');
    expect($validator->status(array_replace(emptyNotePlan(), ['delete' => [[]]])))->toBe('confirm');
    expect($validator->status(array_replace(emptyNotePlan(), ['ambiguous' => [[]]])))->toBe('confirm');
    expect($validator->status(array_replace(emptyNotePlan(), ['skipped' => [['reason' => 'skip']]])))->toBe('followup');
    expect($validator->status(array_replace(emptyNotePlan(), ['skipped' => [['reason' => 'not_found']]])))->toBe('done');
});

it('rejects foreign IDs even when the allowed set is empty (T-NU-71, SEC-41)', function () {
    $id = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['update' => [['ref' => 'u1', 'task_id' => $id, 'label' => 'Completed', 'done' => true]], 'delete' => [['ref' => 'd1', 'task_id' => $id, 'label' => 'Delete']]]);
    $result = app(PlanValidator::class)->validate($plan, [], []);
    expect($result['dropped'])->toBe(2)->and($result['update'])->toBe([])->and($result['delete'])->toBe([]);
});

it('validates real dates, enums, update fields and merged time ranges', function () {
    $id = (string) Str::uuid();
    $plan = array_replace(emptyNotePlan(), ['update' => [
        ['ref' => 'u1', 'task_id' => $id, 'label' => 'Move', 'due_date' => '2026-02-31'],
        ['ref' => 'u2', 'task_id' => $id, 'label' => 'Move', 'priority' => 'critical'],
        ['ref' => 'u3', 'task_id' => $id, 'label' => 'Move', 'end_time' => '08:00'],
        ['ref' => 'u4', 'task_id' => $id, 'label' => 'Completed', 'done' => true],
    ]]);
    $result = app(PlanValidator::class)->validate($plan, [], [$id => ['start_time' => '09:00', 'end_time' => '10:00']]);
    expect($result['dropped'])->toBe(3)->and($result['update'])->toHaveCount(1);
    expect($result['update'][0])->not->toHaveKey('due_date');
});

it('rejects a timed create without the required local date', function () {
    $create = ['ref' => 'c1', 'title' => 'Call mum', 'due_date' => null, 'start_time' => '09:00', 'end_time' => null, 'priority' => 'low', 'project_id' => null, 'repeat' => 'never', 'reminder' => 'none', 'notes' => null, 'duplicate_of' => null];
    $plan = array_replace(emptyNotePlan(), ['create' => [$create]]);
    expect(app(PlanValidator::class)->validate($plan, [], [])['dropped'])->toBe(1);
});
