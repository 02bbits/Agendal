<?php

use App\Enums\CommandAction;
use App\Enums\SkipReason;
use App\Services\Notes\CommandMatch;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteVocabulary;
use Tests\Support\NoteRules;
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
    'a US date' => ['move pay rent to 11/20', 'rent', ['due_date' => '2026-11-20']],
    'a target word in the title' => ['move talk to bank to friday', 'bank', ['due_date' => '2026-10-30']],
]);

const RENT_TASK = ['id' => 'rent', 'title' => 'Pay rent', 'due_date' => '2026-11-01'];

const STANDUP_TASK = ['id' => 'standup', 'title' => 'Standup', 'due_date' => '2026-10-26', 'start_time' => '09:00', 'end_time' => '09:15'];

/** @return array<string, array{string}> */
function ruleCases(string $category, string $template): array
{
    $notes = array_map(fn (string $value): string => str_replace('{}', $value, $template), NoteRules::values($category));

    return array_combine($notes, array_map(fn (string $note): array => [$note], $notes));
}

it('completes with every complete verb and ending in the rules', function (string $text) {
    expect(matchCommand($text, CommandAction::Complete, [RENT_TASK])->change?->fields)->toBe(['done' => true]);
})->with([...ruleCases('complete_command', '{} pay rent'), ...ruleCases('complete_suffix', 'pay rent {}'), ...ruleCases('complete_suffix_bare', 'pay rent {}')]);

it('deletes with every delete verb in the rules', function (string $text) {
    expect(matchCommand($text, CommandAction::Delete, [RENT_TASK])->change?->delete)->toBeTrue();
})->with(ruleCases('delete_command', '{} pay rent'));

/** @return array<string, array{string}> every move verb with every target word of the rules */
function moveWordings(): array
{
    $cases = [];
    foreach (NoteRules::values('move_command') as $verb) {
        foreach (NoteRules::values('reschedule_target') as $target) {
            $cases["{$verb} … {$target}"] = ["{$verb} pay rent on the 1st {$target} the 5th"];
        }
    }

    return $cases;
}

it('reschedules with every move verb and target word in the rules', function (string $text) {
    expect(matchCommand($text, CommandAction::Reschedule, [RENT_TASK])->change?->fields)->toBe(['due_date' => '2026-11-05']);
})->with(moveWordings());

/** @return array<string, array{string, string}> the old date written in the subject × the new date in the target */
function subjectAndTargetDates(): array
{
    $targets = ['the 5th' => '2026-11-05', '5/11' => '2026-11-05', 'Nov 5' => '2026-11-05', 'ngày 5' => '2026-11-05', 'friday' => '2026-10-30', 'tomorrow' => '2026-10-24', 'next week' => '2026-10-26'];
    $cases = [];
    foreach (['', 'on the 1st', 'due 1/11', '1/11', 'Nov 1', 'ngày 1', 'at 9am', '9am'] as $subject) {
        foreach ($targets as $target => $due) {
            $text = trim("move pay rent {$subject}").' to '.$target;
            $cases[$text] = [$text, $due];
        }
    }

    return $cases;
}

it('takes the new date from the target whatever the subject says', function (string $text, string $due) {
    expect(matchCommand($text, CommandAction::Reschedule, [RENT_TASK])->change?->fields)->toBe(['due_date' => $due]);
})->with(subjectAndTargetDates());

it('takes the new time from the target and moves or sets the end (NU-E35)', function (string $text, array $fields) {
    expect(matchCommand($text, CommandAction::Reschedule, [STANDUP_TASK])->change?->fields)->toBe($fields);
})->with([
    ['move 9am standup to 10am', ['start_time' => '10:00', 'end_time' => '10:15']],
    ['move standup at 9:00 to 10:30', ['start_time' => '10:30', 'end_time' => '10:45']],
    ['dời standup 9h sang 10h', ['start_time' => '10:00', 'end_time' => '10:15']],
    ['move standup to 2pm', ['start_time' => '14:00', 'end_time' => '14:15']],
    ['move standup to tomorrow 10am', ['due_date' => '2026-10-24', 'start_time' => '10:00', 'end_time' => '10:15']],
    ['move standup to 10-11am', ['start_time' => '10:00', 'end_time' => '11:00']],
    ['move standup to 9-10am', ['end_time' => '10:00']],
    ['move standup to 11:50pm', ['start_time' => '23:50', 'end_time' => null]],
]);

it('gives a time without a date today, or tomorrow once it has passed, on a task with no date (NU-E5)', function (string $text, array $fields) {
    expect(matchCommand($text, CommandAction::Reschedule, [['id' => 'd', 'title' => 'Dentist']])->change?->fields)->toBe($fields);
})->with([
    'later today' => ['move dentist to 10am', ['due_date' => '2026-10-23', 'start_time' => '10:00']],
    'already passed' => ['move dentist to 7am', ['due_date' => '2026-10-24', 'start_time' => '07:00']],
    'in hours' => ['move dentist to in 2 hours', ['due_date' => '2026-10-23', 'start_time' => '10:12']],
    'a date stays the date' => ['move dentist to friday 7am', ['due_date' => '2026-10-30', 'start_time' => '07:00']],
]);

it('keeps the date of a dated task when only a time is given (NU-E35)', function () {
    expect(matchCommand('move standup to 7am', CommandAction::Reschedule, [STANDUP_TASK])->change?->fields)->toBe(['start_time' => '07:00', 'end_time' => '07:15']);
});

it('changes nothing when the task already has the new date and time', function (string $text) {
    expect(matchCommand($text, CommandAction::Reschedule, [RENT_TASK, STANDUP_TASK]))->toMatchObject(['change' => null, 'skip' => SkipReason::AlreadyDone]);
})->with(['move pay rent to 1/11', 'move pay rent to the 1st', 'move standup to 9am', 'move standup to monday 9am', 'move standup to 9-9:15am', 'chuyển standup sang thứ 2 9h']);

it('picks the tied task the reschedule would change', function () {
    $open = [['id' => 'fri', 'title' => 'Weekly report', 'due_date' => '2026-10-23'], ['id' => 'later', 'title' => 'Weekly report', 'due_date' => '2026-10-30']];
    $match = matchCommand('move weekly report to today', CommandAction::Reschedule, $open);

    expect([$match->change?->taskId, $match->change?->fields, $match->tiedTaskIds])->toBe(['later', ['due_date' => '2026-10-23'], ['fri', 'later']]);
});

/** @return array<string, array{string}> every priority and repeat phrase of the rules */
function modifierPhrases(): array
{
    $categories = array_filter(array_unique(array_column(NoteRules::rows(), 0)), fn (string $category): bool => in_array($category, ['priority_high', 'priority_low'], true) || str_starts_with($category, 'repeat:'));
    $phrases = array_merge(...array_map(NoteRules::values(...), array_values($categories)));

    return array_combine($phrases, array_map(fn (string $phrase): array => [$phrase], $phrases));
}

it('prefers the title with the repeat or priority word, and matches without it', function (string $phrase) {
    $withWord = ['id' => 'with', 'title' => ucfirst($phrase).' report'];
    $match = matchCommand("done {$phrase} report", CommandAction::Complete, [['id' => 'plain', 'title' => 'Report'], $withWord]);

    expect([$match->change?->taskId, $match->isTie()])->toBe(['with', false])
        ->and(matchCommand("done {$phrase} report", CommandAction::Complete, [['id' => 'plain', 'title' => 'Report']])->change?->taskId)->toBe('plain');
})->with(modifierPhrases());

it('prefers the title the command names fully over a longer one, and ties titles equally close', function (string $text, array $titles, ?string $expected, bool $tie) {
    $open = array_map(fn (string $id, string $title): array => ['id' => $id, 'title' => $title], array_keys($titles), $titles);
    $match = matchCommand($text, CommandAction::Complete, $open);

    expect([$match->change?->taskId, $match->isTie()])->toBe([$expected, $tie]);
})->with([
    'exact over longer' => ['done buy milk', ['eggs' => 'Buy milk and eggs', 'milk' => 'Buy milk'], 'milk', false],
    'shorter of two longer' => ['done buy milk', ['long' => 'Buy milk, eggs and bread', 'mid' => 'Buy milk early'], 'mid', false],
    'stop words are no extra' => ['done call mum', ['for' => 'Call for mum', 'about' => 'Call mum about rent'], 'for', false],
    'Vietnamese' => ['xong mua sữa', ['more' => 'Mua sữa và trứng', 'exact' => 'Mua sữa'], 'exact', false],
    'equally close is a tie' => ['done report', ['w' => 'Weekly report', 'm' => 'Monthly report'], 'm', true],
    'same title is a tie' => ['done call mum', ['a' => 'Call mum', 'b' => 'Call mum'], 'a', true],
]);

it('tells a weekly report from a monthly one', function () {
    $open = [['id' => 'm', 'title' => 'Monthly report', 'due_date' => '2026-10-24'], ['id' => 'w', 'title' => 'Weekly report', 'due_date' => '2026-10-26']];

    expect(matchCommand('move weekly report to friday', CommandAction::Reschedule, $open)->change?->taskId)->toBe('w')
        ->and(matchCommand('move report to friday', CommandAction::Reschedule, $open)->isTie())->toBeTrue();
});

it('makes a task of a delete with a deadline when no task matches, and deletes one that does (NU-E29)', function (string $word) {
    $unmatched = matchCommand("cancel netflix {$word} friday", CommandAction::Delete, [])->newTask;
    $matched = matchCommand("cancel netflix {$word} friday", CommandAction::Delete, [['id' => 'n', 'title' => 'Netflix']]);

    expect([$unmatched?->title, $unmatched?->dueDate])->toBe(['Cancel netflix', '2026-10-30'])
        ->and([$matched->change?->taskId, $matched->change?->delete])->toBe(['n', true])
        ->and(matchCommand("cancel netflix {$word}", CommandAction::Delete, [])->skip)->toBe(SkipReason::NotFound);
})->with(fn (): array => NoteRules::values('deadline_prefix'));

it('makes a task of a delete with a place when no task matches, but not of one with a time (NU-E29)', function (string $word) {
    expect(matchCommand("drop the kids {$word} school", CommandAction::Delete, [])->newTask?->title)->toBe("Drop the kids {$word} school")
        ->and(matchCommand("drop the meeting {$word} 3pm", CommandAction::Delete, [])->skip)->toBe(SkipReason::NotFound)
        ->and(matchCommand("drop the meeting {$word} noon", CommandAction::Delete, [])->skip)->toBe(SkipReason::NotFound);
})->with(fn (): array => NoteRules::values('place_prefix'));

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
