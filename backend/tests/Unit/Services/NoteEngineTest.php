<?php

use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use Tests\TestCase;

uses(TestCase::class);

it('is deterministic with explicit time and zone (T-NU-70)', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $engine = app(NoteEngine::class);
    $first = $engine->build('call mum tomorrow; read tonight', $context);
    expect($engine->build('call mum tomorrow; read tonight', $context))->toBe($first);
    expect($first['plan']['create'])->toHaveCount(2);
});

it('keeps remaining text as tasks once the rules budget expires (SEC-23)', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $result = app(NoteEngine::class)->build('call mum tomorrow; read tonight', $context, limitMs: 0);
    expect(array_column($result['plan']['create'], 'title'))->toBe(['call mum tomorrow', 'read tonight']);
    expect(array_column($result['plan']['create'], 'due_date'))->toBe([null, null]);
});
