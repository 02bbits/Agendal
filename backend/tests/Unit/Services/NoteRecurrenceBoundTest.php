<?php

use App\Enums\WeekStart;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteSplitter;
use App\Services\Notes\NoteVocabulary;
use App\Services\Tasks\RepeatSchedule;
use Tests\TestCase;

uses(TestCase::class);

/*
 * How long a series runs (#120): "for 3 months", "trong 4 tuần", "this week", "tháng sau". The end becomes UNTIL on
 * the last day: a duration counts from the series' first date, last day included; a period ends on its last day.
 * Anything not read in full keeps the whole item at low confidence instead of an unbounded schedule.
 */

/** Monday 2 Nov 2026, 12:51 in Ho Chi Minh City, unless a test says otherwise. */
function boundContext(string $now = '2026-11-02T12:51:00+07:00', WeekStart $weekStart = WeekStart::Monday): NoteContext
{
    return new NoteContext(new DateTimeImmutable($now), 'Asia/Ho_Chi_Minh', weekStart: $weekStart);
}

/** @return array<string, mixed> the one task the note makes */
function boundTask(string $text, ?NoteContext $context = null): array
{
    $build = app(NoteEngine::class)->build(app(NoteSplitter::class)->normalize($text), $context ?? boundContext(), budgetMs: 60000);
    expect($build->lowConfidence, $text)->toBe([])->and($build->plan['create'], $text)->toHaveCount(1);

    return $build->plan['create'][0];
}

/** @param array<string, mixed> $task */
function expectUntil(array $task, string $text, string $first, ?string $until): void
{
    expect($task['due_date'], $text)->toBe($first);
    $until === null
        ? expect($task['repeat_rule'], $text)->not->toContain('UNTIL=')
        : expect($task['repeat_rule'], $text)->toEndWith(';UNTIL='.str_replace('-', '', $until).'T235959Z');
}

function expectPreserved(string $text, ?NoteContext $context = null): void
{
    $build = app(NoteEngine::class)->build(app(NoteSplitter::class)->normalize($text), $context ?? boundContext(), budgetMs: 60000);
    expect($build->lowConfidence, $text)->toBe(['i1' => $text])
        ->and($build->plan['create'][0]['due_date'], $text)->toBeNull()
        ->and($build->plan['create'][0]['repeat'], $text)->toBe('never')
        ->and(mb_strtolower($build->plan['create'][0]['title']), $text)->toBe(mb_strtolower($text));
}

it('ends a series that runs for an amount of time, counted from its first date', function (string $text, string $title, string $first, string $until, string $last) {
    $task = boundTask($text);
    expectUntil($task, $text, $first, $until);
    expect($task['title'])->toBe($title)
        ->and(RepeatSchedule::onOrAfter($task['repeat_rule'], $first, $last))->toBe($last)
        ->and(RepeatSchedule::onOrAfter($task['repeat_rule'], $first, (new DateTimeImmutable($last))->modify('+1 day')->format('Y-m-d')))->toBeNull();
})->with([
    ['gym every day for 3 days', 'Gym', '2026-11-02', '2026-11-04', '2026-11-04'],
    ['call mum every day for 3 months', 'Call mum', '2026-11-02', '2027-02-01', '2027-02-01'],
    ['call mum every week for 3 months', 'Call mum', '2026-11-02', '2027-02-01', '2027-02-01'],
    ['call mum every month for a year', 'Call mum', '2026-11-02', '2027-11-01', '2027-10-02'],
    ['renew every year for 3 years', 'Renew', '2026-11-02', '2029-11-01', '2028-11-02'],
    ['gym every Monday and Wednesday for 2 weeks', 'Gym', '2026-11-02', '2026-11-15', '2026-11-11'],
    ['gym from 1/12 every day for 2 weeks', 'Gym', '2026-12-01', '2026-12-14', '2026-12-14'],
    ['lái xe mỗi thứ 3 trong 4 tuần', 'Lái xe', '2026-11-03', '2026-11-30', '2026-11-24'],
    ['học mỗi ngày trong vòng mười ngày', 'Học', '2026-11-02', '2026-11-11', '2026-11-11'],
    ['tập gym hàng tháng trong 3 tháng', 'Tập gym', '2026-11-02', '2027-02-01', '2027-01-02'],
]);

it('reads every way of writing a duration', function (string $text, string $first, string $until) {
    $task = boundTask($text);
    expectUntil($task, $text, $first, $until);
    expect($task['title'])->toBe('Gym');
})->with([
    ['gym every day for three weeks', '2026-11-02', '2026-11-22'],
    ['gym every day for the next 3 weeks', '2026-11-02', '2026-11-22'],
    ['gym every day for the next week', '2026-11-02', '2026-11-08'],
    ['gym every day for 3 more weeks', '2026-11-02', '2026-11-22'],
    ['gym every day for a fortnight', '2026-11-02', '2026-11-15'],
    ['gym every day over the next 2 weeks', '2026-11-02', '2026-11-15'],
    ['gym every day during 2 weeks', '2026-11-02', '2026-11-15'],
    ['gym every day for 10 days straight', '2026-11-02', '2026-11-11'],
    ['gym every day for 2 wks', '2026-11-02', '2026-11-15'],
    ['gym every day for 3 mos', '2026-11-02', '2027-02-01'],
    ['gym daily for 2 weeks', '2026-11-02', '2026-11-15'],
    ['gym for 2 weeks every day', '2026-11-02', '2026-11-15'],
    ['gym for 2 weeks, every day', '2026-11-02', '2026-11-15'],
    ['gym every day, for 2 weeks', '2026-11-02', '2026-11-15'],
    ['gym every other day for 2 weeks', '2026-11-02', '2026-11-15'],
    ['gym every weekday for 2 weeks', '2026-11-02', '2026-11-15'],
    ['gym every day at 7am for 2 weeks', '2026-11-03', '2026-11-16'],
    ['gym 7am every day for 2 weeks', '2026-11-03', '2026-11-16'],
    ['gym every day from tomorrow for 2 weeks', '2026-11-03', '2026-11-16'],
    ['gym every day for 2 weeks from 1/12', '2026-12-01', '2026-12-14'],
    ['gym every day 2 weeks from now for 3 weeks', '2026-11-16', '2026-12-06'],
    ['gym mỗi ngày trong 2 tuần', '2026-11-02', '2026-11-15'],
    ['gym mỗi ngày trong 2 tuần tới', '2026-11-02', '2026-11-15'],
    ['gym mỗi ngày trong 2 tuần liền', '2026-11-02', '2026-11-15'],
    ['gym mỗi ngày suốt 2 tuần', '2026-11-02', '2026-11-15'],
    ['gym mỗi ngày kéo dài 2 tuần', '2026-11-02', '2026-11-15'],
    ['gym mỗi ngày liên tục 2 tuần', '2026-11-02', '2026-11-15'],
    ['gym mỗi ngày trong năm ngày', '2026-11-02', '2026-11-06'],
    ['gym mỗi ngày trong 1 năm', '2026-11-02', '2027-11-01'],
    ['gym mỗi ngày, trong 2 tuần', '2026-11-02', '2026-11-15'],
    ['gym cách ngày trong 2 tuần', '2026-11-02', '2026-11-15'],
    ['gym thứ 2 4 6 hàng tuần trong 1 tháng', '2026-11-02', '2026-12-01'],
    ['gym mỗi ngày lúc 7h trong 2 tuần', '2026-11-03', '2026-11-16'],
    ['gym từ mai mỗi ngày trong 2 tuần', '2026-11-03', '2026-11-16'],
    ['gym every day for 2weeks', '2026-11-02', '2026-11-15'],
    ['gym every day through Friday', '2026-11-02', '2026-11-06'],
    ['gym every day till Friday', '2026-11-02', '2026-11-06'],
    ['gym every day through next week', '2026-11-02', '2026-11-15'],
    ['gym every day through next week at 8am', '2026-11-03', '2026-11-15'],
    ['gym mỗi ngày đến hết tuần sau', '2026-11-02', '2026-11-15'],
]);

it('reads the wordings reported against the first fix', function () {
    expectUntil(boundTask('lái xe mỗi thứ 3 trong 4tuần'), '4tuần', '2026-11-03', '2026-11-30');
    $task = boundTask('gym every Monday, Wednesday and Friday for 3 weeks');
    expectUntil($task, 'Mon, Wed, Fri', '2026-11-02', '2026-11-22');
    expect($task['repeat_rule'])->toContain('BYDAY=MO,WE,FR');
    foreach (['gym every Monday, Wednesday and Friday for several weeks', 'gym every day for about 3 weeks', 'tập gym mỗi ngày trong 3 ngày rưỡi',
        'gym every day for a week and a half', 'gym mỗi ngày mấy tuần liền', 'gym every day for 3 weeks or so', 'gym mỗi thứ 3 2,5 tuần',
        'gym every day through next week until Friday', 'gym every day for 3 months from now', 'gym every day for 3 days and 12 hours',
        'gym every day until Friday until Sunday'] as $text) {
        expectPreserved($text);
    }
});

it('reads every bound phrase in the shared rules', function () {
    $cases = [];
    foreach (NoteVocabulary::values('bound_lead') as $lead) {
        $cases["gym every day $lead 2 weeks"] = '2026-11-15';
    }
    foreach (NoteVocabulary::values('bound_lead_next') as $lead) {
        $cases["gym every day $lead 2 weeks"] = '2026-11-15';
        $cases["gym every day $lead week"] = '2026-11-08';
    }
    foreach (NoteVocabulary::values('bound_trail') as $trail) {
        $cases["gym every day for 2 weeks $trail"] = '2026-11-15';
    }
    foreach (NoteVocabulary::values('bound_more') as $more) {
        $cases["gym every day for 2 $more weeks"] = '2026-11-15';
    }
    foreach (NoteVocabulary::values('bound_fortnight') as $fortnight) {
        $cases["gym every day for 1 $fortnight"] = '2026-11-15';
    }
    $periods = ['week:0' => ['2026-11-02', '2026-11-08'], 'week:1' => ['2026-11-09', '2026-11-15'], 'month:0' => ['2026-11-02', '2026-11-30'],
        'month:1' => ['2026-12-01', '2026-12-31'], 'year:0' => ['2026-11-02', '2026-12-31'], 'year:1' => ['2027-01-01', '2027-12-31']];
    foreach ($periods as $key => [$first, $until]) {
        foreach (NoteVocabulary::values('bound_period:'.$key) as $period) {
            $task = boundTask("gym every day $period");
            expectUntil($task, $period, $first, $until);
            expect($task['title'], $period)->toBe('Gym');
        }
    }
    foreach (NoteVocabulary::values('bound_until_lead') as $lead) {
        $cases["gym every day $lead hết tuần"] = '2026-11-08';
    }
    foreach ($cases as $text => $until) {
        $task = boundTask($text);
        expectUntil($task, $text, '2026-11-02', $until);
        expect($task['title'], $text)->toBe('Gym');
    }
    foreach (NoteVocabulary::values('bound_start_lead') as $lead) {
        expectUntil(boundTask("gym every day $lead next week"), $lead, '2026-11-09', null);
    }
});

it('runs a series through the rest of a calendar period, from the next free day', function (string $now, string $text, string $first, string $until, WeekStart $weekStart = WeekStart::Monday) {
    expectUntil(boundTask($text, boundContext($now, $weekStart)), $text, $first, $until);
})->with([
    'before the time' => ['2026-11-02T06:00:00+07:00', 'gym every day at 7am this week', '2026-11-02', '2026-11-08'],
    'after the time' => ['2026-11-02T12:51:00+07:00', 'gym every day at 7am this week', '2026-11-03', '2026-11-08'],
    'vietnamese' => ['2026-11-02T12:51:00+07:00', 'gym mỗi ngày lúc 7h trong tuần này', '2026-11-03', '2026-11-08'],
    'today, no time' => ['2026-11-02T12:51:00+07:00', 'gym every day this week', '2026-11-02', '2026-11-08'],
    'weekday today' => ['2026-11-02T12:51:00+07:00', 'gym every Monday this week', '2026-11-02', '2026-11-08'],
    'weekdays' => ['2026-11-02T12:51:00+07:00', 'gym every weekday this week', '2026-11-02', '2026-11-08'],
    'stated start inside' => ['2026-11-02T12:51:00+07:00', 'gym every day this week from tomorrow', '2026-11-03', '2026-11-08'],
    'until the end' => ['2026-11-02T12:51:00+07:00', 'gym mỗi ngày đến hết tuần', '2026-11-02', '2026-11-08'],
    'rest of the week' => ['2026-11-02T12:51:00+07:00', 'gym every day for the rest of the week', '2026-11-02', '2026-11-08'],
    'next week' => ['2026-11-02T12:51:00+07:00', 'gym every day next week', '2026-11-09', '2026-11-15'],
    'next week, vietnamese' => ['2026-11-02T12:51:00+07:00', 'gym mỗi ngày tuần sau', '2026-11-09', '2026-11-15'],
    'during next week' => ['2026-11-02T12:51:00+07:00', 'gym every day during next week', '2026-11-09', '2026-11-15'],
    'weekly next month' => ['2026-11-02T12:51:00+07:00', 'gym hàng tuần tháng sau', '2026-12-01', '2026-12-31'],
    'monthly next year' => ['2026-11-02T12:51:00+07:00', 'gym mỗi tháng năm sau', '2027-01-01', '2027-12-31'],
    'last day of the week' => ['2026-11-08T08:00:00+07:00', 'gym every day this week', '2026-11-08', '2026-11-08'],
    'last day, before the time' => ['2026-11-08T08:00:00+07:00', 'gym every day at 9am this week', '2026-11-08', '2026-11-08'],
    'next week from sunday' => ['2026-11-08T08:00:00+07:00', 'gym every day next week', '2026-11-09', '2026-11-15'],
    'sunday week start' => ['2026-11-07T08:00:00+07:00', 'gym every day this week', '2026-11-07', '2026-11-07', WeekStart::Sunday],
    'sunday week start, next' => ['2026-11-07T08:00:00+07:00', 'gym every day next week', '2026-11-08', '2026-11-14', WeekStart::Sunday],
    'last day of the month' => ['2026-11-30T20:00:00+07:00', 'gym every day this month', '2026-11-30', '2026-11-30'],
    'next month from 31 jan' => ['2027-01-31T08:00:00+07:00', 'gym every day next month', '2027-02-01', '2027-02-28'],
    'last day of the year' => ['2026-12-31T22:00:00+07:00', 'gym every day this year', '2026-12-31', '2026-12-31'],
    'next year' => ['2026-12-31T22:00:00+07:00', 'gym every year next year', '2027-01-01', '2027-12-31'],
]);

it('keeps a relative start apart from a duration bound', function (string $text, string $first) {
    expectUntil(boundTask($text), $text, $first, null);
})->with([
    ['gym every day in 2 weeks', '2026-11-16'],
    ['gym every day 2 weeks from now', '2026-11-16'],
    ['gym every day 2 weeks later', '2026-11-16'],
    ['gym mỗi ngày trong 2 tuần nữa', '2026-11-16'],
    ['gym mỗi ngày 3 ngày nữa', '2026-11-05'],
    ['gym every day from next week', '2026-11-09'],
    ['gym mỗi ngày từ tuần sau', '2026-11-09'],
]);

it('gives each copy the same bound', function (string $text, string $until) {
    $build = app(NoteEngine::class)->build($text, boundContext(), budgetMs: 60000);
    expect($build->lowConfidence)->toBe([])->and($build->plan['create'])->toHaveCount(3);
    foreach ($build->plan['create'] as $task) {
        expect($task['repeat_rule'])->toEndWith(';UNTIL='.$until.'T235959Z');
    }
})->with([
    ['visit house 3 times every day for 2 weeks', '20261115'],
    ['gym mỗi ngày 3 lần trong 2 tuần', '20261115'],
    ['gym 3 times every day this week', '20261108'],
]);

it('keeps the following task apart from a bounded series', function (string $text) {
    expect(app(NoteSplitter::class)->split($text))->toHaveCount(2);
    $build = app(NoteEngine::class)->build($text, boundContext(), budgetMs: 60000);
    expect($build->plan['create'][0]['title'])->toBe('Gym')
        ->and($build->plan['create'][0]['repeat_rule'])->toContain(';UNTIL=')
        ->and($build->plan['create'][1]['title'])->toBe('Buy milk');
})->with([
    'gym every Monday for 3 weeks, buy milk',
    'gym every day for 2 weeks at 8am, buy milk',
    'gym every day this week, buy milk',
]);

it('preserves a bound it cannot read in full', function (string $text) {
    expectPreserved($text);
})->with([
    'gym every day for 0 weeks',
    'gym every day for 1.5 months',
    'gym every day for half a month',
    'gym every day for 3 occurrences for 2 weeks',
    'gym every day for 2 weeks until Friday',
    'gym every day for 2 weeks never ends',
    'gym every day for 2 weeks for 2 weeks',
    'gym every day for 2 weeks and 3 days',
    'gym every day for 2 weeks or 3 weeks',
    'gym every day this week and next week',
    'gym every day this week for 2 weeks',
    'gym every day this week until Friday',
    'gym every day this week for 3 occurrences',
    'gym every day this week from 1/12',
]);

it('preserves a period with no occurrence left in it', function (string $now, string $text, WeekStart $weekStart = WeekStart::Monday) {
    expectPreserved($text, boundContext($now, $weekStart));
})->with([
    'weekday already passed' => ['2026-11-03T08:00:00+07:00', 'gym every Monday this week'],
    'no weekday left' => ['2026-11-07T08:00:00+07:00', 'gym every weekday this week'],
    'time passed on the last day' => ['2026-11-08T08:00:00+07:00', 'gym every day at 7am this week'],
    'time passed, sunday week start' => ['2026-11-07T08:00:00+07:00', 'gym every day at 7am this week', WeekStart::Sunday],
    'time passed on the last day of the month' => ['2026-11-30T20:00:00+07:00', 'gym every day at 7am this month'],
    'time passed on the last day of the year' => ['2026-12-31T22:00:00+07:00', 'gym every day at 9pm this year'],
]);

it('leaves a one-off task and a session length alone', function () {
    expect(boundTask('call mum for 3 months')['repeat'])->toBe('never')
        ->and(boundTask('đi chợ trong 3 ngày nữa')['due_date'])->toBe('2026-11-05')
        ->and(boundTask('call mum 2 weeks from now')['due_date'])->toBe('2026-11-16')
        ->and(boundTask('gym every day for 1 hour')['repeat_rule'])->not->toContain('UNTIL=');
});
