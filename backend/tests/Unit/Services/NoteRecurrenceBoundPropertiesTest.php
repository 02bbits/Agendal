<?php

use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteEngine;
use App\Services\Notes\NoteSplitter;
use App\Services\Notes\NoteVocabulary;
use Tests\TestCase;

uses(TestCase::class);

/*
 * #120 as properties over generated wordings rather than a list of examples. A recurring note that says how long it
 * runs ends in exactly one of two ways: an UNTIL on the right day with the words gone from the title, or the whole
 * item kept for review. Never an unbounded series, never a start moved by words that only said how long.
 */

const BOUND_NOW = '2026-11-02T12:51:00+07:00';

/** Schedules and their first date from Monday 2 Nov 2026, 12:51. */
const BOUND_SCHEDULES = [
    'every day' => '2026-11-02',
    'mỗi ngày' => '2026-11-02',
    'every Monday' => '2026-11-02',
    'mỗi thứ 3' => '2026-11-03',
    'every Monday, Wednesday and Friday' => '2026-11-02',
    'every other day' => '2026-11-02',
    'every weekday' => '2026-11-02',
    'hàng tuần' => '2026-11-02',
];

/** Unit words with the PHP unit a whole amount of them adds. */
const BOUND_UNITS = [
    'day' => 'day', 'days' => 'day', 'ngày' => 'day',
    'week' => 'week', 'weeks' => 'week', 'wk' => 'week', 'wks' => 'week', 'tuần' => 'week',
    'month' => 'month', 'months' => 'month', 'mo' => 'month', 'mos' => 'month', 'tháng' => 'month',
    'year' => 'year', 'years' => 'year', 'yr' => 'year', 'yrs' => 'year', 'năm' => 'year',
];

/** @return array{low: bool, task: array<string, mixed>} the note's one task, or the first when the item is kept */
function boundOutcome(string $text): array
{
    $build = app(NoteEngine::class)->build(app(NoteSplitter::class)->normalize($text), new NoteContext(new DateTimeImmutable(BOUND_NOW), 'Asia/Ho_Chi_Minh'), budgetMs: 60000);

    return ['low' => $build->lowConfidence !== [], 'task' => $build->plan['create'][0]];
}

function lastDayAfter(string $first, int $amount, string $unit): string
{
    return (new DateTimeImmutable($first))->modify(sprintf('+%d %s', $amount, $unit))->modify('-1 day')->format('Ymd');
}

/** @return list<string> what $text breaks, given the UNTIL day it must end on, or null when it must be kept for review */
function boundViolations(string $text, string $title, string $first, ?string $until): array
{
    ['low' => $low, 'task' => $task] = boundOutcome($text);
    if ($until === null) {
        return $low && $task['repeat'] === 'never' && $task['due_date'] === null ? [] : ["$text: should be kept for review, got ".json_encode([$task['title'], $task['due_date'], $task['repeat_rule'] ?? null], JSON_UNESCAPED_UNICODE)];
    }
    $got = [$low, $task['title'], $task['due_date'], $task['repeat_rule'] ?? ''];

    return ! $low && $task['title'] === $title && $task['due_date'] === $first && str_ends_with($task['repeat_rule'] ?? '', ';UNTIL='.$until.'T235959Z')
        ? [] : ["$text: want $first..$until, got ".json_encode($got, JSON_UNESCAPED_UNICODE)];
}

it('ends every whole duration on its last day, whatever the lead, unit or spacing', function () {
    $violations = [];
    $leads = [...NoteVocabulary::values('bound_lead'), ...NoteVocabulary::values('bound_lead_next')];
    foreach ($leads as $lead) {
        foreach (BOUND_UNITS as $word => $unit) {
            foreach (['every day' => '2026-11-02', 'mỗi thứ 3' => '2026-11-03'] as $schedule => $first) {
                foreach (["3 $word", "3$word"] as $amount) {
                    $violations = [...$violations, ...boundViolations("gym $schedule $lead $amount", 'Gym', $first, lastDayAfter($first, 3, $unit))];
                }
            }
        }
    }
    expect($violations)->toBe([]);
});

it('ends every schedule, in every position and amount spelling', function () {
    $violations = [];
    $amounts = ['2' => 2, 'two' => 2, 'hai' => 2, 'a' => 1, 'một' => 1, 'ten' => 10, 'mười' => 10];
    foreach (BOUND_SCHEDULES as $schedule => $first) {
        foreach ($amounts as $word => $amount) {
            foreach (['week' => 'week', 'tháng' => 'month'] as $unitWord => $unit) {
                $bound = "for $word $unitWord";
                $until = lastDayAfter($first, $amount, $unit);
                foreach (["gym $schedule $bound", "gym $bound $schedule", "gym $schedule, $bound"] as $text) {
                    $violations = [...$violations, ...boundViolations($text, 'Gym', $first, $until)];
                }
            }
        }
    }
    expect($violations)->toBe([]);
});

it('keeps for review every duration it cannot read exactly', function () {
    $violations = [];
    $inexact = ['1.5 weeks', '2,5 tuần', 'half a month', 'nửa tháng', '3 ngày rưỡi', 'a week and a half', '2 and a half weeks', 'several weeks', 'a few weeks', 'vài tuần', 'mấy tuần'];
    foreach (NoteVocabulary::values('bound_approximate') as $approx) {
        $inexact[] = "$approx 3 weeks";
    }
    foreach (NoteVocabulary::values('bound_approximate_suffix') as $suffix) {
        $inexact[] = "3 weeks $suffix";
    }
    foreach (BOUND_SCHEDULES as $schedule => $first) {
        foreach ($inexact as $bound) {
            foreach (["gym $schedule for $bound", "gym $schedule trong $bound", "gym $schedule $bound"] as $text) {
                $violations = [...$violations, ...boundViolations($text, 'Gym', $first, null)];
            }
        }
    }
    expect($violations)->toBe([]);
});

it('keeps for review a duration that conflicts with another end', function () {
    $violations = [];
    $ends = ['until Friday', 'through next week', 'till 20/11', 'đến hết tuần', 'for 2 weeks', 'this week', 'for 3 occurrences'];
    $conflicts = ['for 2 weeks and 3 days', 'for 2 weeks or 3 weeks', 'for 3 days and 12 hours', 'for 3 days, 12 hours', 'trong 3 ngày và 12 tiếng',
        'for 12 hours and 3 days', 'for 2 weeks never ends', 'this week and next week', 'trong 2 tuần đến ngày 30/11',
        'for 3 months from now', 'for 3 months later', 'during 2 weeks from now', 'suốt 2 tuần nữa'];
    // Any two ends, in either order, are one too many.
    foreach ($ends as $first) {
        foreach ($ends as $second) {
            if ($first !== $second) {
                $conflicts[] = "$first $second";
            }
        }
    }
    foreach ($conflicts as $bound) {
        foreach (BOUND_SCHEDULES as $schedule => $first) {
            $violations = [...$violations, ...boundViolations("gym $schedule $bound", 'Gym', $first, null)];
        }
    }
    expect($violations)->toBe([]);
});

it('moves only the start for a duration marked as a start', function () {
    $violations = [];
    foreach (['in 2 weeks', 'after 2 weeks', '2 weeks later', '2 weeks from now', 'sau 2 tuần', '2 tuần nữa', 'trong 2 tuần nữa', 'in 2weeks'] as $start) {
        ['low' => $low, 'task' => $task] = boundOutcome("gym every day $start");
        if ($low || $task['due_date'] !== '2026-11-16' || str_contains($task['repeat_rule'] ?? '', 'UNTIL=') || $task['title'] !== 'Gym') {
            $violations[] = "$start: ".json_encode([$low, $task['title'], $task['due_date'], $task['repeat_rule'] ?? null], JSON_UNESCAPED_UNICODE);
        }
    }
    expect($violations)->toBe([]);
});

it('runs every period phrase to its end, with every lead', function () {
    $violations = [];
    $periods = ['week:0' => ['2026-11-02', '20261108'], 'week:1' => ['2026-11-09', '20261115'], 'month:0' => ['2026-11-02', '20261130'],
        'month:1' => ['2026-12-01', '20261231'], 'year:0' => ['2026-11-02', '20261231'], 'year:1' => ['2027-01-01', '20271231']];
    foreach ($periods as $key => [$first, $until]) {
        foreach (NoteVocabulary::values('bound_period:'.$key) as $period) {
            foreach (['', ...NoteVocabulary::values('bound_lead')] as $lead) {
                $violations = [...$violations, ...boundViolations(trim("gym every day $lead $period"), 'Gym', $first, $until)];
            }
            // "through next week" runs from today to the end of that period.
            foreach (NoteVocabulary::values('bound_through_lead') as $lead) {
                $violations = [...$violations, ...boundViolations("gym every day $lead $period", 'Gym', '2026-11-02', $until)];
            }
            // "from next week" only starts the series.
            foreach (NoteVocabulary::values('bound_start_lead') as $lead) {
                ['low' => $low, 'task' => $task] = boundOutcome("gym every day $lead $period");
                if (! $low && str_contains($task['repeat_rule'] ?? '', 'UNTIL=')) {
                    $violations[] = "$lead $period: a start is no end";
                }
            }
        }
    }
    expect($violations)->toBe([]);
});
