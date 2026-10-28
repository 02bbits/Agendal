<?php

declare(strict_types=1);

use App\Services\Clock\FrozenClock;
use App\Services\Clock\SystemClock;

test('FrozenClock pins time and formats local dates', function () {
    $clock = new FrozenClock('2026-10-23T08:12:00+07:00');

    expect($clock->today('Asia/Ho_Chi_Minh'))->toBe('2026-10-23')
        ->and($clock->time('Asia/Ho_Chi_Minh'))->toBe('08:12')
        ->and($clock->today('UTC'))->toBe('2026-10-23')
        ->and($clock->time('UTC'))->toBe('01:12')
        ->and($clock->today('America/New_York'))->toBe('2026-10-22')
        ->and($clock->time('America/New_York'))->toBe('21:12');
});

test('FrozenClock advances time', function () {
    $clock = new FrozenClock('2026-10-23T08:12:00+07:00');

    $clock->advance('+48 minutes');
    expect($clock->time('Asia/Ho_Chi_Minh'))->toBe('09:00');

    $clock->advance('+15 hours');
    expect($clock->today('Asia/Ho_Chi_Minh'))->toBe('2026-10-24')
        ->and($clock->time('Asia/Ho_Chi_Minh'))->toBe('00:00');
});

test('computeRemindAtUtc matches ADR-006 expectations', function () {
    $clock = new FrozenClock('2026-10-23T08:12:00+07:00');

    // 09:00 with 15m reminder in Asia/Ho_Chi_Minh (+07:00 = 02:00 UTC) -> 01:45 UTC
    $remind1 = $clock->computeRemindAtUtc('2026-10-26', '09:00', '15m', 'Asia/Ho_Chi_Minh');
    expect($remind1)->toBe('2026-10-26T01:45:00Z');

    // Default 09:00 with 1d reminder -> 2026-10-25 02:00 UTC
    $remind2 = $clock->computeRemindAtUtc('2026-10-26', null, '1d', 'Asia/Ho_Chi_Minh');
    expect($remind2)->toBe('2026-10-25T02:00:00Z');

    // 'none' returns null
    $remind3 = $clock->computeRemindAtUtc('2026-10-26', null, 'none', 'Asia/Ho_Chi_Minh');
    expect($remind3)->toBeNull();
});

test('SystemClock conforms to ClockInterface contract', function () {
    $clock = new SystemClock();

    expect($clock->now())->toBeInstanceOf(DateTimeImmutable::class)
        ->and($clock->today('UTC'))->toMatch('/^\d{4}-\d{2}-\d{2}$/')
        ->and($clock->time('UTC'))->toMatch('/^\d{2}:\d{2}$/');
});
