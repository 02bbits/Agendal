<?php

use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteSplitter;
use App\Services\Tasks\RepeatSchedule;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

function grammarContext(): NoteContext
{
    return new NoteContext(new DateTimeImmutable('2026-11-02T12:51:00+07:00'), 'Asia/Ho_Chi_Minh');
}

it('keeps calendar lists together but splits the following independent task', function (string $item, string $repeat, string $selector, string $first) {
    $text = $item.', buy milk';
    expect(app(NoteSplitter::class)->split($text))->toBe([$item, 'buy milk']);
    $build = app(NoteEngine::class)->build($text, grammarContext(), budgetMs: 60000);
    expect($build->lowConfidence)->toBe([])->and($build->plan['create'])->toHaveCount(2)
        ->and($build->plan['create'][0]['title'])->toBe('Gym')
        ->and($build->plan['create'][0]['repeat'])->toBe($repeat)
        ->and($build->plan['create'][0]['repeat_rule'])->toContain($selector)
        ->and($build->plan['create'][0]['due_date'])->toBe($first)
        ->and($build->plan['create'][1]['repeat'])->toBe('never');
})->with([
    ['gym 2, 4, 6 hàng tuần', 'weekly', 'BYDAY=MO,WE,FR', '2026-11-02'],
    ['gym mỗi tuần thứ 2, 4, 6', 'weekly', 'BYDAY=MO,WE,FR', '2026-11-02'],
    ['gym every Monday, Wednesday at 8am', 'weekly', 'BYDAY=MO,WE', '2026-11-04'],
    ['gym every Monday, Wednesday until Friday', 'weekly', 'UNTIL=20261106T235959Z', '2026-11-02'],
    ['gym every Monday, Wednesday until 2026-12-31', 'weekly', 'UNTIL=20261231T235959Z', '2026-11-02'],
    ['gym every Monday, Wednesday for 3 occurrences', 'weekly', 'COUNT=3', '2026-11-02'],
    ['gym every month on day 1, 15, 25', 'monthly', 'BYMONTHDAY=1,15,25', '2026-11-15'],
    ['gym every month on 1st, 15th and 25th', 'monthly', 'BYMONTHDAY=1,15,25', '2026-11-15'],
    ['gym monthly 1st, 15th and 25th', 'monthly', 'BYMONTHDAY=1,15,25', '2026-11-15'],
    ['gym every month on first and third Monday', 'monthly', 'BYDAY=1MO,3MO', '2026-11-02'],
    ['gym every month on first, third and last Monday', 'monthly', 'BYDAY=1MO,3MO,-1MO', '2026-11-02'],
    ['gym every month on the 1st, 15th and 25th', 'monthly', 'BYMONTHDAY=1,15,25', '2026-11-15'],
    ['gym ngày 1, 15, 25 hàng tháng', 'monthly', 'BYMONTHDAY=1,15,25', '2026-11-15'],
    ['gym every first Monday, last Friday of month', 'monthly', 'BYDAY=1MO,-1FR', '2026-11-02'],
    ['gym thứ hai đầu tiên và thứ sáu cuối cùng hàng tháng', 'monthly', 'BYDAY=1MO,-1FR', '2026-11-02'],
]);

it('keeps all comma-separated weekday selections independent of the task verb and frequency position', function () {
    $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    $numbers = ['2', '3', '4', '5', '6', '7', 'CN'];
    foreach (range(1, 127) as $mask) {
        $selected = array_keys(array_filter($days, fn (string $day, int $i): bool => ($mask & (1 << $i)) !== 0, ARRAY_FILTER_USE_BOTH));
        $english = implode(', ', array_intersect_key($days, array_flip($selected)));
        $vietnamese = implode(', ', array_intersect_key($numbers, array_flip($selected)));
        foreach (["gym every $english", "gym $vietnamese hàng tuần", "gym mỗi tuần $vietnamese"] as $text) {
            $build = app(NoteEngine::class)->build($text.', buy milk', grammarContext(), budgetMs: 60000);
            expect(app(NoteSplitter::class)->split($text.', buy milk'), $text)->toBe([$text, 'buy milk']);
            expect($build->lowConfidence, $text)->toBe([])
                ->and($build->plan['create'], $text)->toHaveCount(2);
            $task = $build->plan['create'][0];
            preg_match('/;BYDAY=([A-Z,]+)/', $task['repeat_rule'], $ruleDays);
            $expected = array_values(array_intersect_key(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], array_flip($selected)));
            $actual = explode(',', $ruleDays[1]);
            sort($expected);
            sort($actual);
            expect($actual, $text)->toBe($expected)->and($task['title'])->toBe('Gym');
        }
    }
});

it('expands an explicit number per scheduled day without inventing times', function (string $text, int $copies) {
    $build = app(NoteEngine::class)->build($text, grammarContext(), budgetMs: 60000);
    expect($build->lowConfidence)->toBe([])->and($build->plan['dropped'])->toBe(0)
        ->and($build->plan['create'])->toHaveCount($copies);
    foreach ($build->plan['create'] as $i => $task) {
        expect($task['repeat'])->toBe('daily')->and($task['start_time'])->toBeNull()
            ->and($task['due_date'])->toBe('2026-11-02')
            ->and($task['repeat_rule'])->not->toContain('COUNT=');
        if ($copies > 1) {
            expect($task['title'])->toEndWith(' ('.($i + 1).'/'.$copies.')');
        }
    }
})->with([
    ['visit house 3 times every day', 3],
    ['visit house every day 3 times', 3],
    ['visit house three times a day', 3],
    ['visit house twice per day', 2],
    ['visit house once each day', 1],
    ['đi gym mỗi ngày 3 lần', 3],
    ['đi gym ba lần mỗi ngày', 3],
    ['đi gym 3 lần/ngày', 3],
]);

it('keeps multiplicity separate from the total number of recurrence dates', function () {
    $build = app(NoteEngine::class)->build('visit house 3 times every day for 2 occurrences', grammarContext(), budgetMs: 60000);
    expect($build->plan['create'])->toHaveCount(3)->and($build->lowConfidence)->toBe([]);
    foreach ($build->plan['create'] as $task) {
        expect($task['repeat_rule'])->toContain('COUNT=2')
            ->and(RepeatSchedule::onOrAfter($task['repeat_rule'], $task['due_date'], '2026-11-04'))->toBeNull();
    }
    $single = app(NoteEngine::class)->build('visit house every day for 3 times', grammarContext(), budgetMs: 60000);
    expect($single->plan['create'])->toHaveCount(1)
        ->and($single->plan['create'][0]['repeat_rule'])->toContain('COUNT=3');
});

it('preserves unsupported or conflicting recurrence text without scheduling a partial interpretation', function (string $text) {
    $build = app(NoteEngine::class)->build($text, grammarContext(), budgetMs: 60000);
    expect($build->lowConfidence)->toBe(['i1' => $text])
        ->and($build->plan['create'])->toHaveCount(1)
        ->and($build->plan['create'][0]['due_date'])->toBeNull()
        ->and($build->plan['create'][0]['repeat'])->toBe('never')
        ->and(mb_strtolower($build->plan['create'][0]['title']))->toBe(mb_strtolower($text));
})->with([
    'gym biweekly',
    'gym daily biweekly',
    'gym 0 times every day',
    'gym 31 times every day',
    'gym -3 times every day',
    'gym 1.5 times every day',
    'gym 3 times every day at 8am',
    'gym every day at 8am, 5pm',
    'gym every Monday, Wednesday except the first Monday',
    'gym every month on day 0, 15, 32',
]);

it('does not merge a weekday task or a literal into an earlier calendar list', function () {
    expect(app(NoteSplitter::class)->split('gym every Monday, Wednesday report, buy milk'))
        ->toBe(['gym every Monday', 'Wednesday report', 'buy milk']);
    expect(app(NoteSplitter::class)->split('read https://example.com/every-Monday,Wednesday, buy milk'))
        ->toBe(['read https://example.com/every-Monday,Wednesday', 'buy milk']);
});

it('consumes date introducers only when they belong to the parsed weekday', function (string $text, string $title) {
    $build = app(NoteEngine::class)->build($text, grammarContext(), budgetMs: 60000);
    expect($build->plan['create'][0]['title'])->toBe($title)
        ->and($build->plan['create'][0]['due_date'])->toBe('2026-11-07')
        ->and($build->plan['create'][0]['start_time'])->toBe('08:00');
})->with([
    ['đi ăn gia đình ngày thứ 7 8h sáng', 'Đi ăn gia đình'],
    ['đi ăn gia đình vào ngày thứ bảy lúc 8h sáng', 'Đi ăn gia đình'],
]);

it('enforces the note item limit after expanding per-day copies', function () {
    expect(fn () => app(NoteEngine::class)->build('gym 20 times every day; visit house 20 times every day', grammarContext(), budgetMs: 60000))
        ->toThrow(ValidationException::class, 'note.too_many_items');
});

it('does not read task quantities as recurrence weekdays', function () {
    $build = app(NoteEngine::class)->build('read chapter 3 every Monday and Wednesday', grammarContext(), budgetMs: 60000);
    expect($build->lowConfidence)->toBe([])->and($build->plan['create'][0]['title'])->toBe('Read chapter 3')
        ->and($build->plan['create'][0]['repeat_rule'])->toContain('BYDAY=MO,WE');
});

it('retains all title text when numbering maximum-length repeated tasks', function () {
    $title = str_repeat('x', 200);
    $build = app(NoteEngine::class)->build($title.' 3 times every day', grammarContext(), budgetMs: 60000);
    expect($build->plan['create'])->toHaveCount(3);
    foreach ($build->plan['create'] as $task) {
        expect(mb_strlen($task['title']))->toBe(200)
            ->and(mb_strtolower(preg_replace('/ \(\d\/3\)$/', '', $task['title']).$task['notes']))->toBe($title);
    }
});

it('reads every selection of shared monthly ordinals without dropping qualifiers', function () {
    $ordinals = ['first', 'second', 'third', 'fourth', 'last'];
    $numbers = [1, 2, 3, 4, -1];
    foreach (range(1, 31) as $mask) {
        $selected = array_keys(array_filter($ordinals, fn (string $ordinal, int $i): bool => ($mask & (1 << $i)) !== 0, ARRAY_FILTER_USE_BOTH));
        foreach ([', ', ' and '] as $joiner) {
            $phrase = implode($joiner, array_intersect_key($ordinals, array_flip($selected)));
            $text = 'gym every month on '.$phrase.' Monday';
            $build = app(NoteEngine::class)->build($text, grammarContext(), budgetMs: 60000);
            $expected = implode(',', array_map(fn (int $i): string => $numbers[$i].'MO', $selected));
            expect($build->lowConfidence, $text)->toBe([])
                ->and($build->plan['create'], $text)->toHaveCount(1)
                ->and($build->plan['create'][0]['title'])->toBe('Gym')
                ->and($build->plan['create'][0]['repeat_rule'])->toContain('BYDAY='.$expected);
        }
    }
});
