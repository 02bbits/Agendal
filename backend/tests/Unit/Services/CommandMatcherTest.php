<?php

use App\Enums\CommandAction;
use App\Enums\SkipReason;
use App\Services\Notes\CommandMatch;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteVocabulary;
use Tests\TestCase;

uses(TestCase::class);

/** Friday 23 Oct 2026, 08:12 in Ho Chi Minh City. */
function matchCommand(string $text, CommandAction $action, array $open, array $done = []): CommandMatch
{
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');

    return app(CommandMatcher::class)->match($text, $action, $open, $done, $context);
}

const EMAIL_TASK = ['id' => 't1', 'title' => 'Email the group', 'due_date' => '2026-10-23', 'start_time' => '09:00', 'end_time' => '10:00'];

it('completes the matching task in every phrasing (T-NU-20)', function (string $text) {
    $match = matchCommand($text, CommandAction::Complete, [['id' => 'm', 'title' => 'Call mum']]);

    expect([$match->change?->taskId, $match->change?->fields, $match->change?->label])->toBe(['m', ['done' => true], 'Completed']);
})->with(['done call mum', 'finished call mum', 'did call mum', 'call mum is done', 'call mum done', 'đã xong call mum', 'call mum xong rồi', 'Done: the call mum task']);

it('reschedules with the was-label and keeps or moves the times (T-NU-21, NU-E35)', function (string $text, array $fields, string $label) {
    $match = matchCommand($text, CommandAction::Reschedule, [EMAIL_TASK]);

    expect([$match->change?->fields, $match->change?->label])->toBe([$fields, $label]);
})->with([
    'date and time move the end too' => ['move email group to tomorrow 2pm', ['due_date' => '2026-10-24', 'start_time' => '14:00', 'end_time' => '15:00'], 'Due Sat 24 Oct (was today)'],
    'a date alone keeps the times' => ['move email group to Friday', ['due_date' => '2026-10-30'], 'Due Fri 30 Oct (was today)'],
    'a time alone keeps the date' => ['move email group to 2pm', ['start_time' => '14:00', 'end_time' => '15:00'], 'Email the group'],
    'the date it already has is no change' => ['move email group to today', [], 'Email the group'],
    'an end past midnight is dropped' => ['move email group to 11:30pm', ['start_time' => '23:30', 'end_time' => null], 'Email the group'],
]);

it('labels a task that had no date', function () {
    $match = matchCommand('dời đọc sách sang thứ 2', CommandAction::Reschedule, [['id' => 'b', 'title' => 'Đọc sách']]);

    expect($match->change?->label)->toBe('Due Mon 26 Oct (was no date)');
});

it('deletes the matching task (T-NU-22)', function () {
    $match = matchCommand('xóa bài tập SQL', CommandAction::Delete, [['id' => 's', 'title' => 'Bài tập SQL']]);

    expect([$match->change?->taskId, $match->change?->delete, $match->change?->label])->toBe(['s', true, 'Bài tập SQL']);
});

it('matches at 60% and not below (T-NU-23)', function () {
    $matcher = app(CommandMatcher::class);

    expect($matcher->score(['a', 'b', 'c', 'd', 'e'], 'a b c'))->toBe(0.6)
        ->and(matchCommand('done alpha beta gamma delta epsilon', CommandAction::Complete, [['id' => 'x', 'title' => 'alpha beta gamma']])->change?->taskId)->toBe('x')
        ->and(matchCommand('done alpha beta gamma delta epsilon', CommandAction::Complete, [['id' => 'x', 'title' => 'alpha beta']])->skip)->toBe(SkipReason::NotFound);
});

it('ignores done and deleted tasks among the open candidates (T-NU-24)', function () {
    $open = [['id' => 'd', 'title' => 'Call mum', 'done' => true], ['id' => 'x', 'title' => 'Call mum', 'deleted_at' => '2026-10-20']];

    expect(matchCommand('done call mum', CommandAction::Complete, $open)->skip)->toBe(SkipReason::NotFound);
});

it('keeps diacritics: Vietnamese matches only as typed (T-NU-25)', function () {
    $tasks = [['id' => 'vi', 'title' => 'Bài tập SQL']];

    expect(matchCommand('xong bài tập sql', CommandAction::Complete, $tasks)->change?->taskId)->toBe('vi')
        ->and(matchCommand('xong bai tap sql', CommandAction::Complete, $tasks)->skip)->toBe(SkipReason::NotFound);
});

it('offers up to 5 tied tasks, soonest due first and no date last (NU-E11)', function () {
    $tasks = [
        ['id' => 'none', 'title' => 'Call mum'],
        ...array_map(fn (int $day): array => ['id' => 'd'.$day, 'title' => 'Call mum', 'due_date' => '2026-10-'.(20 + $day)], range(9, 3, -1)),
    ];
    $match = matchCommand('done call mum', CommandAction::Complete, $tasks);

    expect([$match->isTie(), $match->tiedTaskIds, $match->change?->taskId])->toBe([true, ['d3', 'd4', 'd5', 'd6', 'd7'], 'd3']);
});

it('skips a command whose task is already done (NU-E12)', function () {
    expect(matchCommand('done call mum', CommandAction::Complete, [], [['id' => 'd', 'title' => 'Call mum']])->skip)->toBe(SkipReason::AlreadyDone);
});

it('turns an unmatched reschedule into a new task and skips other commands (NU-E29)', function () {
    $new = matchCommand('move go to gym to tomorrow', CommandAction::Reschedule, [])->newTask;

    expect([$new?->title, $new?->dueDate])->toBe(['Go to gym', '2026-10-24'])
        ->and(matchCommand('delete absent task', CommandAction::Delete, [])->skip)->toBe(SkipReason::NotFound);
});

it('reads the task from before the target and the new when only after it', function (string $text, string $taskId, array $fields) {
    $open = [
        ['id' => 'standup', 'title' => '9am standup', 'due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '09:15'],
        ['id' => 'rent', 'title' => 'Pay rent', 'due_date' => '2026-11-01'],
        ['id' => 'bank', 'title' => 'Talk to bank'],
    ];
    $match = matchCommand($text, CommandAction::Reschedule, $open);

    expect([$match->change?->taskId, $match->change?->fields])->toBe([$taskId, $fields]);
})->with([
    'a time in the title' => ['move 9am standup to 10am', 'standup', ['start_time' => '10:00', 'end_time' => '10:15']],
    'a preferred date in the subject' => ['move pay rent on the 1st to the 5th', 'rent', ['due_date' => '2026-11-05']],
    'a numeric date in the subject' => ['move pay rent due 1/11 to 5/11', 'rent', ['due_date' => '2026-11-05']],
    'Vietnamese day numbers' => ['chuyển pay rent ngày 1 sang ngày 5', 'rent', ['due_date' => '2026-11-05']],
    'a target word in the title' => ['move talk to bank to friday', 'bank', ['due_date' => '2026-10-30']],
]);

it('builds an unmatched reschedule from the target date, not the subject one (NU-E29)', function () {
    $new = matchCommand('move standup on monday to tuesday 10am', CommandAction::Reschedule, [])->newTask;

    expect([$new?->title, $new?->dueDate, $new?->startTime])->toBe(['Standup', '2026-10-27', '10:00']);
});

it('leaves every stop word out of the meaningful words', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $matcher = app(CommandMatcher::class);

    foreach (NoteVocabulary::values('stop_word') as $stopWord) {
        expect($matcher->words('done call '.$stopWord.' mum', $context))->toBe(['call', 'mum'], $stopWord);
    }
});

it('reads the threshold and tie limit from config', function () {
    config(['notes.match_threshold' => 1.0, 'notes.tie_choices' => 2]);
    $tasks = array_map(fn (int $id): array => ['id' => (string) $id, 'title' => 'Call mum'], range(1, 4));

    expect(matchCommand('done call mum', CommandAction::Complete, $tasks)->tiedTaskIds)->toBe(['1', '2'])
        ->and(matchCommand('done call mum now', CommandAction::Complete, $tasks)->skip)->toBe(SkipReason::NotFound);
});
