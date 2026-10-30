<?php

declare(strict_types=1);

use App\Services\Clock\ClientClock;
use App\Services\Clock\ReminderCalculator;
use App\Services\Clock\SystemClock;
use App\Services\Clock\WallTime;
use Tests\Support\FrozenClock;

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

test('reminder calculator matches ADR-006 expectations', function () {
    $calculator = new ReminderCalculator;

    // 09:00 with 15m reminder in Asia/Ho_Chi_Minh (+07:00 = 02:00 UTC) -> 01:45 UTC
    $remind1 = $calculator->compute('2026-10-26', '09:00', '15m', 'Asia/Ho_Chi_Minh');
    expect($remind1)->toBe('2026-10-26T01:45:00Z');

    // Default 09:00 with 1d reminder -> 2026-10-25 02:00 UTC
    $remind2 = $calculator->compute('2026-10-26', null, '1d', 'Asia/Ho_Chi_Minh');
    expect($remind2)->toBe('2026-10-25T02:00:00Z');

    // 'none' returns null
    $remind3 = $calculator->compute('2026-10-26', null, 'none', 'Asia/Ho_Chi_Minh');
    expect($remind3)->toBeNull();
});

test('SystemClock conforms to ClockInterface contract', function () {
    $clock = new class extends SystemClock
    {
        public function now(): DateTimeImmutable
        {
            return new DateTimeImmutable('2026-10-23T01:12:00Z');
        }
    };

    expect($clock->now())->toBeInstanceOf(DateTimeImmutable::class)
        ->and($clock->today('UTC'))->toBe('2026-10-23')
        ->and($clock->time('Asia/Ho_Chi_Minh'))->toBe('08:12');
});

test('wall times follow ADR-006 across DST and local midnight', function (string $date, string $time, string $zone, string $expected) {
    expect(WallTime::toUtc($date, $time, $zone)->format('Y-m-d\TH:i:s\Z'))->toBe($expected);
})->with([
    ['2026-03-08', '02:30', 'America/New_York', '2026-03-08T07:00:00Z'],
    ['2026-11-01', '01:30', 'America/New_York', '2026-11-01T05:30:00Z'],
    ['2026-10-25', '02:30', 'Europe/Berlin', '2026-10-25T00:30:00Z'],
    ['2026-10-04', '02:15', 'Australia/Lord_Howe', '2026-10-03T15:30:00Z'],
    ['2026-10-24', '00:00', 'Asia/Ho_Chi_Minh', '2026-10-23T17:00:00Z'],
]);

test('invalid floating dates and times are rejected', function (string $date, string $time) {
    expect(fn () => WallTime::toUtc($date, $time, 'UTC'))->toThrow(InvalidArgumentException::class);
})->with([
    ['2026-02-30', '09:00'],
    ['2026-10-25', '24:00'],
    ['2026-10-25', '09:60'],
    ['invalid', '09:00'],
]);

test('reminder offsets use elapsed UTC time across DST', function () {
    expect((new ReminderCalculator)->compute('2026-03-08', '03:30', '1h', 'America/New_York'))
        ->toBe('2026-03-08T06:30:00Z');
});

test('ClientClock pins now to written_at in the note zone', function () {
    $clock = ClientClock::fromWrittenAt('2026-10-22T23:30:00+07:00', new FrozenClock('2026-10-23T08:00:00Z'));

    expect($clock->now()->format('Y-m-d\TH:i:s\Z'))->toBe('2026-10-22T16:30:00Z')
        ->and($clock->today('Asia/Ho_Chi_Minh'))->toBe('2026-10-22')
        ->and($clock->time('Asia/Ho_Chi_Minh'))->toBe('23:30');
});

test('ClientClock clamps written_at to server time', function (string $writtenAt, string $expected) {
    $clock = ClientClock::fromWrittenAt($writtenAt, new FrozenClock('2026-10-23T01:12:00Z'));

    expect($clock->now()->format('Y-m-d\TH:i:s\Z'))->toBe($expected);
})->with([
    'within 5 min ahead' => ['2026-10-23T01:16:00Z', '2026-10-23T01:16:00Z'],
    'too far ahead' => ['2026-10-24T08:00:00+07:00', '2026-10-23T01:17:00Z'],
    'exactly 30 days old' => ['2026-09-23T01:12:00Z', '2026-09-23T01:12:00Z'],
    'older than 30 days' => ['2026-09-23T01:11:00Z', '2026-10-23T01:12:00Z'],
]);

test('ClientClock rejects written_at without an offset', function (string $writtenAt) {
    expect(fn () => ClientClock::fromWrittenAt($writtenAt, new FrozenClock('2026-10-23T01:12:00Z')))
        ->toThrow(InvalidArgumentException::class);
})->with(['2026-10-23T08:12:00', '2026-10-23', 'yesterday', '2026-13-01T08:12:00Z']);
