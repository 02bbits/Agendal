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

    expect(array_column($build->plan['skipped'], 'reason'))->toBe(['skip', 'no_change'])
        ->and(array_column($build->plan['update'], 'task_id'))->toBe(['a0000000-0000-4000-8000-000000000001'])
        ->and(array_column($build->plan['create'], 'title'))->toBe(['Buy milk, eggs'])
        ->and($build->status)->toBe(PlanStatus::Confirm)
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

it('splits "and" around a command by the open tasks, and leaves a hedged command unchanged (#156)', function () {
    $open = [['id' => 'd0000000-0000-4000-8000-000000000001', 'title' => 'Email group'], ['id' => 'd0000000-0000-4000-8000-000000000002', 'title' => 'Report', 'due_date' => '2026-10-26']];
    $engine = app(NoteEngine::class);

    $build = $engine->build('done email group and call mum', engineContext(), $open);
    expect(array_column($build->plan['update'], 'task_id'))->toBe(['d0000000-0000-4000-8000-000000000001'])
        ->and(array_column($build->plan['create'], 'title'))->toBe(['Call mum'])
        ->and($build->lowConfidence)->toBe([]);

    $build = $engine->build('done email group and report', engineContext(), $open);
    expect(array_column($build->plan['update'], 'task_id'))->toBe(['d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002'])
        ->and($build->plan['create'])->toBe([]);

    foreach (['move report to friday but keep it high priority', 'done email group but not report', 'if it rains, delete report'] as $note) {
        $build = $engine->build($note, engineContext(), $open);
        expect($build->plan['update'])->toBe([])->and($build->plan['delete'])->toBe([])->and($build->lowConfidence)->toBe(['i1' => $note]);
    }
});

it('collects low-confidence items for the LLM fallback (ADR-008)', function () {
    $build = app(NoteEngine::class)->build('comprar leche; call mum tomorrow', engineContext());

    expect($build->lowConfidence)->toBe(['i1' => 'comprar leche']);
});

it('reads the rules budget from config', function () {
    config(['notes.engine_budget_ms' => 0]);

    expect(app(NoteEngine::class)->build('call mum tomorrow', engineContext())->plan['create'][0]['title'])->toBe('call mum tomorrow');
});

it('sends every item of a chatty note to the model, in order (ADR-008)', function () {
    $text = 'hôm nay mệt quá. mai nộp báo cáo SQL 5h chiều. tối gọi mẹ';
    $build = app(NoteEngine::class)->build($text, engineContext());

    expect(array_keys($build->lowConfidence))->toBe(['i1', 'i2', 'i3'])
        ->and($build->lowConfidence['i2'])->toBe('mai nộp báo cáo SQL 5h chiều');
});

it('sends a long note whole once any item is uncertain, and keeps a short or sure one on the rules (ADR-008)', function (int $sure, bool $uncertain, int $sent) {
    config(['note_llm.whole_note_items' => 10]);
    $items = array_map(fn (int $i): string => "call client {$i} tomorrow", range(1, $sure));
    $text = implode('. ', $uncertain ? [...$items, 'comprar leche'] : $items);

    expect(app(NoteEngine::class)->build($text, engineContext())->lowConfidence)->toHaveCount($sent);
})->with([
    '10 items, one uncertain' => [9, true, 10],
    '9 items, one uncertain' => [8, true, 1],
    '10 items, all sure' => [10, false, 0],
]);

it('reads a pasted markdown note: headings, bold labels and date lines make no task', function () {
    $text = "### 7. Wednesday – Customer complaint\nWED, NOV 25 · 11:15 AM\n\n**Meeting notes**\n\n**Follow-up:**\n- Ask Lisa for the **support** report\n- Contact the affected client";
    $build = app(NoteEngine::class)->build($text, engineContext());

    expect(array_column($build->plan['create'], 'title'))->toBe(['Ask Lisa for the support report', 'Contact the affected client'])
        ->and(array_column($build->plan['skipped'], 'text'))->toBe(['Wednesday – Customer complaint:', 'WED, NOV 25', '11:15 AM', 'Meeting notes:', 'Follow-up:']);
});

it('keeps a task that only mentions a date', function () {
    expect(array_column(app(NoteEngine::class)->build('meet Nov 25', engineContext())->plan['create'], 'title'))->toBe(['Meet']);
});

it('keeps a plain task list on the rules', function () {
    expect(app(NoteEngine::class)->build('mai nộp báo cáo SQL 5h chiều. tối gọi mẹ', engineContext())->lowConfidence)->toBe([]);
});

it('calls a reference the note does not explain unclear, and a move it cannot date unclear for the model to read', function () {
    foreach (['xử lý vụ hôm qua nói', 'làm cái đó lúc nào cũng được', 'follow up on what we talked about'] as $note) {
        $build = app(NoteEngine::class)->build($note, engineContext());
        expect($build->plan['create'], $note)->toBe([])
            ->and(array_column($build->plan['skipped'], 'reason'), $note)->toBe(['unclear'])
            ->and($build->lowConfidence, $note)->toBe([]);
    }
    $open = [['id' => 'e0000000-0000-4000-8000-000000000001', 'title' => 'Chạy bộ', 'due_date' => '2026-10-24']];
    $build = app(NoteEngine::class)->build('dời chạy bộ sang hôm khác', engineContext(), $open);
    expect($build->lowConfidence)->toBe(['i1' => 'dời chạy bộ sang hôm khác'])
        ->and($build->plan['update'])->toBe([])->and($build->plan['create'])->toBe([])
        ->and(array_column($build->plan['skipped'], 'reason'))->toBe(['unclear']);
});
