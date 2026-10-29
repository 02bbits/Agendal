<?php

use App\Services\Notes\CommandMatcher;
use App\Services\Notes\NoteContext;
use Tests\TestCase;

uses(TestCase::class);

it('matches dates and times without counting them as title words (T-NU-20–25)', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $matcher = app(CommandMatcher::class);
    $tasks = [['id' => 't1', 'title' => 'Email the group', 'due_date' => '2026-10-23', 'start_time' => '09:00', 'end_time' => '10:00']];
    $result = $matcher->match('move email group to tomorrow 2pm', 'reschedule', $tasks, [], $context);
    expect($result['entry'])->toMatchArray(['task_id' => 't1', 'due_date' => '2026-10-24', 'start_time' => '14:00', 'end_time' => '15:00']);
    expect($result['entry'])->not->toHaveKey('done');
    $result = $matcher->match('move email group to Friday', 'reschedule', $tasks, [], $context);
    expect($result['entry'])->not->toHaveKey('start_time');
    expect($matcher->score(['a', 'b', 'c', 'd', 'e'], 'a b c'))->toBe(0.6);
    expect($matcher->score(['bài', 'tập'], 'bai tap'))->toBe(0.0);
});

it('limits ties and handles completed and unmatched tasks', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $matcher = app(CommandMatcher::class);
    $tasks = array_map(fn (int $id): array => ['id' => (string) $id, 'title' => 'Call mum'], range(1, 8));
    expect($matcher->match('done call mum', 'complete', $tasks, [], $context)['candidates'])->toHaveCount(5);
    expect($matcher->match('đã xong bài tập', 'complete', [['id' => 'vi', 'title' => 'Bài tập']], [], $context)['entry']['task_id'])->toBe('vi');
    expect($matcher->match('done call mum', 'complete', [], $tasks, $context))->toBe(['skip' => 'already_done']);
    expect($matcher->match('delete absent task', 'delete', [], [], $context))->toBe(['skip' => 'not_found']);
    expect($matcher->match('move call mum to tomorrow', 'reschedule', [], [], $context)['create']['due_date'])->toBe('2026-10-24');
});
