<?php

use App\Services\Notes\FieldExtractor;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteDurations;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteSplitter;
use App\Services\Notes\NoteVocabulary;
use Tests\TestCase;

uses(TestCase::class);

function complexContext(string $at = '2026-11-02T12:51:00+07:00', string $zone = 'Asia/Ho_Chi_Minh'): NoteContext
{
    return new NoteContext(new DateTimeImmutable($at), $zone);
}

it('uses every configured integer alias and duration unit for both relative directions', function () {
    $reader = app(NoteDurations::class);
    foreach (NoteVocabulary::family('amount') as $number => $_) {
        foreach (NoteVocabulary::values('amount:'.$number) as $amount) {
            foreach (NoteVocabulary::family('duration_unit') as $unit => $_) {
                foreach (NoteVocabulary::values('duration_unit:'.$unit) as $word) {
                    foreach (['in '.$amount.' '.$word, $amount.' '.$word.' sau'] as $text) {
                        expect($reader->unreadable($text), $text)->toBeFalse();
                        expect($reader->findAll($text), $text)->toBe([
                            ['unit' => $unit, 'amount' => (int) $number, 'offset' => 0, 'length' => strlen($text)],
                        ]);
                    }
                }
            }
        }
    }
});

it('reads equivalent half-hour phrases across midnight, month/year boundaries and daylight saving', function () {
    $phrases = ['sau nửa tiếng', 'nửa tiếng sau', 'nửa tiếng nữa', 'in half an hour', 'half an hour later', 'in thirty minutes', 'thirty minutes later', 'sau 0030 phút'];
    foreach ([
        ['2026-11-02T12:51:00+07:00', 'Asia/Ho_Chi_Minh', '2026-11-02', '13:21'],
        ['2026-11-03T23:45:00+07:00', 'Asia/Ho_Chi_Minh', '2026-11-04', '00:15'],
        ['2026-12-31T23:45:00+07:00', 'Asia/Ho_Chi_Minh', '2027-01-01', '00:15'],
        ['2028-02-28T23:45:00+07:00', 'Asia/Ho_Chi_Minh', '2028-02-29', '00:15'],
        ['2026-03-08T01:45:00-05:00', 'America/New_York', '2026-03-08', '03:15'],
    ] as [$at, $zone, $date, $time]) {
        $context = complexContext($at, $zone);
        foreach ($phrases as $phrase) {
            $text = 'call mum '.$phrase;
            $fields = app(FieldExtractor::class)->extract($text, $context);
            expect($fields->title, $text)->toBe('Call mum')
                ->and($fields->dueDate)->toBe($date)
                ->and($fields->startTime)->toBe($time)
                ->and($fields->lowConfidence)->toBeFalse();
        }
    }
});

it('does not mistake quantities in the task title for an unsupported time quantity', function (string $text) {
    $fields = app(FieldExtractor::class)->extract($text, complexContext());
    expect($fields->dueDate)->toBe('2026-11-02')->and($fields->startTime)->toBe('13:21')
        ->and($fields->lowConfidence)->toBeFalse();
})->with(['call two friends thirty minutes later', 'call one friend in half an hour']);

it('preserves unsupported quantities rather than consuming only a supported suffix', function (string $text) {
    $fields = app(FieldExtractor::class)->extract($text, complexContext());
    expect(mb_strtolower($fields->title))->toBe(mb_strtolower($text))
        ->and($fields->dueDate)->toBeNull()->and($fields->startTime)->toBeNull()
        ->and($fields->lowConfidence)->toBeTrue();
})->with([
    'call mum in half a month', 'call mum in half a minute', 'call mum in 1.5 hours',
    'call mum in one and a half hours', 'call mum in forty minutes',
    'call mum in one hour and thirty minutes', 'call mum one hour and thirty minutes later',
    'call mum in one month and two days', 'call mum in -2 days',
    'call mum in 999999999999999999999999 hours',
]);

it('keeps shopping lists intact after leading scheduling or priority modifiers', function () {
    foreach (['tomorrow', 'ngày mai', 'at 9am', 'lúc 9h', 'in half an hour', 'nửa tiếng sau', 'urgent', 'cuối tuần'] as $prefix) {
        foreach ([' ', ', '] as $gap) {
            $shopping = $prefix.$gap.'buy milk, eggs and bread';
            expect(app(NoteSplitter::class)->split($shopping.', call mum tomorrow'), $shopping)
                ->toBe([$shopping, 'call mum tomorrow']);
        }
    }
});

it('binds scheduling-only fragments before or after the task without swallowing another task', function () {
    foreach ([['call mum', 'three times', 'every Tuesday'], ['gọi mẹ', 'lặp lại 3 lần', 'thứ 3 mỗi tuần']] as $parts) {
        foreach ([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] as $order) {
            foreach (NoteVocabulary::values('comma') as $comma) {
                $text = implode($comma.' ', array_map(fn (int $i): string => $parts[$i], $order));
                $build = app(NoteEngine::class)->build($text.'; buy milk tomorrow', complexContext(), budgetMs: 60000);
                expect(app(NoteSplitter::class)->split($text.'; buy milk tomorrow'), $text)->toBe([$text, 'buy milk tomorrow']);
                expect($build->lowConfidence, $text)->toBe([])->and($build->plan['create'])->toHaveCount(4)
                    ->and($build->plan['skipped'])->toBe([]);
                foreach (array_slice($build->plan['create'], 0, 3) as $i => $task) {
                    expect($task['title'])->toEndWith(' ('.($i + 1).'/3)')->and($task['due_date'])->toBe('2026-11-03')
                        ->and($task['repeat_rule'])->toContain('BYDAY=TU')->and($task['start_time'])->toBeNull();
                }
                expect($build->plan['create'][3]['title'])->toBe('Buy milk')
                    ->and($build->plan['create'][3]['due_date'])->toBe('2026-11-03');
            }
        }
    }
});

it('keeps every exclusion phrase and its explanation with the original task for fallback', function () {
    foreach (NoteVocabulary::values('repeat_exclusion') as $exclusion) {
        foreach ([' ', ', '] as $gap) {
            $text = 'call mum every Tuesday'.$gap.$exclusion.' 2026-11-10 and 2026-11-24 because of travel';
            $build = app(NoteEngine::class)->build($text.'; buy milk tomorrow', complexContext(), budgetMs: 60000);
            expect(app(NoteSplitter::class)->split($text.'; buy milk tomorrow'), $text)->toBe([$text, 'buy milk tomorrow']);
            expect($build->lowConfidence)->toBe(['i1' => $text])->and($build->plan['create'])->toHaveCount(2);
            $task = $build->plan['create'][0];
            expect(mb_strtolower($task['title']))->toBe(mb_strtolower($text))
                ->and($task['due_date'])->toBeNull()->and($task['start_time'])->toBeNull()->and($task['repeat'])->toBe('never');
        }
    }
});

it('preserves all constraints when relative time conflicts with the selected day or an incomplete multi-copy schedule', function (string $at, string $text) {
    $build = app(NoteEngine::class)->build($text, complexContext($at), budgetMs: 60000);
    expect($build->lowConfidence)->toBe(['i1' => $text])->and($build->plan['create'])->toHaveCount(1)
        ->and(mb_strtolower($build->plan['create'][0]['title']))->toBe(mb_strtolower($text))
        ->and($build->plan['create'][0]['due_date'])->toBeNull()
        ->and($build->plan['create'][0]['start_time'])->toBeNull();
})->with([
    ['2026-11-02T12:51:00+07:00', 'call mum in half an hour every Tuesday'],
    ['2026-11-03T23:45:00+07:00', 'call mum in half an hour every Tuesday'],
    ['2026-11-02T12:51:00+07:00', 'call mum in thirty minutes tomorrow'],
    ['2026-11-03T12:51:00+07:00', 'nửa tiếng sau, plank, lặp lại 3 lần, thứ 3 mỗi tuần'],
]);

it('combines a compatible relative timestamp and weekly schedule without shifting that timestamp', function () {
    $fields = app(FieldExtractor::class)->extract('call mum in half an hour every Tuesday', complexContext('2026-11-03T12:51:00+07:00'));
    expect($fields->title)->toBe('Call mum')->and($fields->dueDate)->toBe('2026-11-03')
        ->and($fields->startTime)->toBe('13:21')->and($fields->repeatRule)->toContain('BYDAY=TU')
        ->and($fields->lowConfidence)->toBeFalse();
});

it('does not interpret temporal words in literals as standalone scheduling fragments', function () {
    expect(app(NoteSplitter::class)->split('read tomorrow.md, buy milk tomorrow'))->toBe(['read tomorrow.md', 'buy milk tomorrow']);
    expect(NoteVocabulary::onlyModifiers('tomorrow.md'))->toBeFalse();
    expect(NoteVocabulary::onlyModifiers('https://example.com/in-half-an-hour'))->toBeFalse();
});

it('does not encode the wrong occurrence of an ambiguous DST minute', function () {
    $fields = app(FieldExtractor::class)->extract('call mum in half an hour', complexContext('2026-11-01T01:45:00-04:00', 'America/New_York'));
    expect($fields->dueDate)->toBeNull()->and($fields->startTime)->toBeNull()
        ->and($fields->title)->toBe('Call mum in half an hour')->and($fields->lowConfidence)->toBeTrue();
});

it('keeps calendar-date phrases distinct from relative quantity hints', function () {
    $fields = app(FieldExtractor::class)->extract('học bài tuần sau', complexContext());
    expect($fields->title)->toBe('Học bài')->and($fields->dueDate)->toBe('2026-11-09')->and($fields->lowConfidence)->toBeFalse();
});

it('uses the same quantity aliases for recurrence boundaries, intervals and total counts', function (string $text, string $rule) {
    $build = app(NoteEngine::class)->build($text, complexContext(), budgetMs: 60000);
    expect($build->plan['create'])->toHaveCount(1)->and($build->lowConfidence)->toBe([])
        ->and($build->plan['create'][0]['title'])->toBe('Call mum')
        ->and($build->plan['create'][0]['repeat_rule'])->toContain($rule);
})->with([
    ['call mum, every three days', 'FREQ=DAILY;INTERVAL=3'],
    ['call mum, mỗi hai tuần', 'FREQ=WEEKLY;INTERVAL=2'],
    ['call mum every Tuesday, for three occurrences', 'COUNT=3'],
    ['call mum mỗi thứ 3, kết thúc sau ba lần', 'COUNT=3'],
]);
