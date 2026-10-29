<?php

use App\Enums\PlanStatus;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use Tests\TestCase;

uses(TestCase::class);

function engineContext(array $projects = []): NoteContext
{
    return new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh', $projects);
}

it('is deterministic with explicit time and zone (T-NU-70)', function () {
    $engine = app(NoteEngine::class);
    $first = $engine->build('call mum tomorrow; read tonight', engineContext());

    expect($engine->build('call mum tomorrow; read tonight', engineContext()))->toEqual($first)
        ->and($first->plan['create'])->toHaveCount(2);
});

it('keeps remaining text as tasks once the rules budget expires (SEC-23)', function () {
    $build = app(NoteEngine::class)->build('call mum tomorrow; read tonight', engineContext(), budgetMs: 0);

    expect(array_column($build->plan['create'], 'title'))->toBe(['call mum tomorrow', 'read tonight'])
        ->and(array_column($build->plan['create'], 'due_date'))->toBe([null, null]);
});

it('plans skips, commands and tasks from one note', function () {
    $open = [['id' => 'a0000000-0000-4000-8000-000000000001', 'title' => 'Call mum'], ['id' => 'a0000000-0000-4000-8000-000000000002', 'title' => 'Gym', 'due_date' => '2026-10-24']];
    $build = app(NoteEngine::class)->build("ok thanks\ndone call mum\nmove gym to tomorrow\nbuy milk, eggs tomorrow", engineContext(), $open);

    expect(array_column($build->plan['skipped'], 'reason'))->toBe(['skip', 'already_done'])
        ->and(array_column($build->plan['update'], 'task_id'))->toBe(['a0000000-0000-4000-8000-000000000001'])
        ->and(array_column($build->plan['create'], 'title'))->toBe(['Buy milk, eggs'])
        ->and($build->status)->toBe(PlanStatus::Done)
        ->and($build->name)->toBe('Buy milk, eggs + 1 more');
});

it('marks a tie for confirmation with the soonest task preselected (NU-E11)', function () {
    $open = [
        ['id' => 'b0000000-0000-4000-8000-000000000002', 'title' => 'Call mum', 'due_date' => '2026-10-30'],
        ['id' => 'b0000000-0000-4000-8000-000000000001', 'title' => 'Call mum', 'due_date' => '2026-10-24'],
    ];
    $build = app(NoteEngine::class)->build('done call mum', engineContext(), $open);

    expect($build->status)->toBe(PlanStatus::Confirm)
        ->and($build->plan['ambiguous'][0]['preselected'])->toBe('b0000000-0000-4000-8000-000000000001');
});

it('flags a new task that looks like an open one but still creates it (NU-E13)', function () {
    $open = [['id' => 'c0000000-0000-4000-8000-000000000001', 'title' => 'Call mum', 'due_date' => '2026-10-24']];
    $build = app(NoteEngine::class)->build('call mum tomorrow', engineContext(), $open);

    expect($build->plan['create'][0]['duplicate_of'])->toBe('c0000000-0000-4000-8000-000000000001');
});

it('collects low-confidence items for the LLM fallback (ADR-008)', function () {
    $build = app(NoteEngine::class)->build('comprar leche; call mum tomorrow', engineContext());

    expect($build->lowConfidence)->toBe(['i1' => 'comprar leche']);
});

it('reads the rules budget from config', function () {
    config(['notes.engine_budget_ms' => 0]);

    expect(app(NoteEngine::class)->build('call mum tomorrow', engineContext())->plan['create'][0]['title'])->toBe('call mum tomorrow');
});
