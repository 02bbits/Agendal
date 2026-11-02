<?php

use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Tasks\RepeatSchedule;
use Tests\TestCase;

uses(TestCase::class);

it('builds calendar dates from English and Vietnamese repeat phrases', function (string $text, string $repeat, array $dates) {
    $context = new NoteContext(new DateTimeImmutable('2026-11-01T22:11:00+07:00'), 'Asia/Ho_Chi_Minh');
    $build = app(NoteEngine::class)->build($text, $context, budgetMs: 60_000);
    expect($build->lowConfidence)->toBe([])->and($build->plan['dropped'])->toBe(0)
        ->and($build->plan['create'])->toHaveCount(1);
    $entry = $build->plan['create'][0];
    expect($entry['repeat'])->toBe($repeat)->and($entry['due_date'])->toBe($dates[0]);
    $actual = [];
    $next = $entry['due_date'];
    foreach ($dates as $_) {
        $actual[] = $next;
        $next = RepeatSchedule::onOrAfter($entry['repeat_rule'], $entry['due_date'], (new DateTimeImmutable($next))->modify('+1 day')->format('Y-m-d'));
    }
    expect($actual)->toBe($dates);
})->with([
    ['tập gym 2 4 6 hàng tuần', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']],
    ['tập gym 2 3 5 hàng tuần', 'weekly', ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-09']],
    ['tập gym mỗi thứ 2 thứ 4', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-09']],
    ['tập gym mỗi thứ hai và thứ tư', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-09']],
    ['gym every Monday and Wednesday', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-09']],
    ['gym every Monday, Wednesday and Friday', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-06']],
    ['tập gym thứ 2, 4, 6 hàng tuần', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-06']],
    ['tập gym 2 4 CN hàng tuần', 'weekly', ['2026-11-01', '2026-11-02', '2026-11-04']],
    ['gym every 2 weeks on Monday and Wednesday', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-16']],
    ['gym every other Monday', 'weekly', ['2026-11-02', '2026-11-16', '2026-11-30']],
    ['gym every Monday to Friday', 'weekly', ['2026-11-02', '2026-11-03', '2026-11-04']],
    ['tập gym mỗi thứ 2 đến thứ 6', 'weekly', ['2026-11-02', '2026-11-03', '2026-11-04']],
    ['gym every weekday', 'weekly', ['2026-11-02', '2026-11-03', '2026-11-04']],
    ['gym every weekend', 'weekly', ['2026-11-01', '2026-11-07', '2026-11-08']],
    ['tập gym hàng ngày', 'daily', ['2026-11-01', '2026-11-02', '2026-11-03']],
    ['tập gym hằng ngày', 'daily', ['2026-11-01', '2026-11-02', '2026-11-03']],
    ['tập gym lặp lại mỗi ngày', 'daily', ['2026-11-01', '2026-11-02', '2026-11-03']],
    ['tập gym lặp lại 2 4 6 hàng tuần', 'weekly', ['2026-11-02', '2026-11-04', '2026-11-06']],
    ['gym every 2 weeks on Monday starting 2026-11-09', 'weekly', ['2026-11-09', '2026-11-23', '2026-12-07']],
    ['gym every 3 days', 'daily', ['2026-11-01', '2026-11-04', '2026-11-07']],
    ['tập gym cách ngày', 'daily', ['2026-11-01', '2026-11-03', '2026-11-05']],
    ['test every second monday of month', 'monthly', ['2026-11-09', '2026-12-14', '2027-01-11']],
    ['họp thứ hai thứ hai mỗi tháng', 'monthly', ['2026-11-09', '2026-12-14', '2027-01-11']],
    ['họp thứ sáu cuối cùng mỗi tháng', 'monthly', ['2026-11-27', '2026-12-25', '2027-01-29']],
    ['gym every fifth Monday of month', 'monthly', ['2026-11-30', '2027-03-29', '2027-05-31']],
    ['pay bills every last day of month', 'monthly', ['2026-11-30', '2026-12-31', '2027-01-31']],
    ['pay bills every month on day 1 and 15', 'monthly', ['2026-11-01', '2026-11-15', '2026-12-01']],
    ['gym every month on the 15th', 'monthly', ['2026-11-15', '2026-12-15', '2027-01-15']],
    ['gym every month on day 15', 'monthly', ['2026-11-15', '2026-12-15', '2027-01-15']],
    ['gym monthly on the 31st', 'monthly', ['2026-12-31', '2027-01-31', '2027-03-31']],
    ['gym every 2 months on the 15th', 'monthly', ['2026-11-15', '2027-01-15', '2027-03-15']],
    ['gym every year on February 29', 'yearly', ['2028-02-29', '2032-02-29', '2036-02-29']],
    ['sinh nhật ngày 29/2 hàng năm', 'yearly', ['2028-02-29', '2032-02-29', '2036-02-29']],
]);

it('keeps conflicting and impossible schedules intact for fallback', function (string $text) {
    $context = new NoteContext(new DateTimeImmutable('2026-11-01T22:11:00+07:00'), 'Asia/Ho_Chi_Minh');
    $build = app(NoteEngine::class)->build($text, $context, budgetMs: 60_000);
    expect($build->lowConfidence)->toBe(['i1' => $text])->and($build->plan['dropped'])->toBe(0)
        ->and($build->plan['create'][0]['due_date'])->toBeNull()
        ->and($build->plan['create'][0]['repeat'])->toBe('never')
        ->and(mb_strtolower($build->plan['create'][0]['title']))->toBe(mb_strtolower($text));
})->with([
    'gym daily monthly',
    'tập gym hàng ngày hàng tháng',
    'gym every 0 days',
    'gym every year on February 30',
    'gym daily for 5 occurrences until 2026-12-31',
    'gym every Monday until 2026-10-01',
    'gym every Monday except the first Monday',
    'gym monthly on 31/2',
]);

it('stops after a count or an inclusive end date', function (string $text, string $last) {
    $context = new NoteContext(new DateTimeImmutable('2026-11-01T22:11:00+07:00'), 'Asia/Ho_Chi_Minh');
    $build = app(NoteEngine::class)->build($text, $context, budgetMs: 60_000);
    $entry = $build->plan['create'][0];
    expect($build->lowConfidence)->toBe([])
        ->and(RepeatSchedule::onOrAfter($entry['repeat_rule'], $entry['due_date'], $last))->toBe($last)
        ->and(RepeatSchedule::onOrAfter($entry['repeat_rule'], $entry['due_date'], (new DateTimeImmutable($last))->modify('+1 day')->format('Y-m-d')))->toBeNull();
})->with([
    ['gym every 3 days for 5 occurrences', '2026-11-13'],
    ['gym mỗi 2 ngày đến 15/11/2026', '2026-11-15'],
    ['gym every Monday until 2026-11-16', '2026-11-16'],
    ['gym every Monday for 1 occurrence', '2026-11-02'],
    ['tập gym mỗi ngày kết thúc sau 2 lần', '2026-11-02'],
]);

it('terminates an impossible interval without enumerating forever', function () {
    expect(RepeatSchedule::onOrAfter('FREQ=YEARLY;INTERVAL=4;BYMONTH=2;BYMONTHDAY=29', '2027-02-28', '2027-03-01'))->toBeNull();
});

it('handles all 127 weekday selections in English and Vietnamese shorthand', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-11-01T22:11:00+07:00'), 'Asia/Ho_Chi_Minh');
    $names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for ($mask = 1; $mask < 128; $mask++) {
        $selected = $english = $vietnamese = [];
        foreach ($names as $index => $name) {
            if ($mask & (1 << $index)) {
                $selected[] = $index + 1;
                $english[] = $name;
                $vietnamese[] = $index === 6 ? 'CN' : (string) ($index + 2);
            }
        }
        $expected = [];
        $date = $context->today();
        while (count($expected) < 3) {
            if (in_array((int) $date->format('N'), $selected, true)) {
                $expected[] = $date->format('Y-m-d');
            }
            $date = $date->modify('+1 day');
        }
        foreach (['gym every '.implode(' and ', $english), 'tập gym '.implode(' ', $vietnamese).' hàng tuần'] as $text) {
            $build = app(NoteEngine::class)->build($text, $context, budgetMs: 60_000);
            expect($build->lowConfidence)->toBe([])->and($build->plan['create'])->toHaveCount(1);
            $entry = $build->plan['create'][0];
            $actual = [$entry['due_date']];
            while (count($actual) < 3) {
                $from = (new DateTimeImmutable(end($actual)))->modify('+1 day')->format('Y-m-d');
                $actual[] = RepeatSchedule::onOrAfter($entry['repeat_rule'], $entry['due_date'], $from);
            }
            expect($actual)->toBe($expected);
        }
    }
});
