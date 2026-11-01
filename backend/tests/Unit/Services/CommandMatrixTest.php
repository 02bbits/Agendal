<?php

use App\Enums\CommandAction;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\ItemClassifier;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteVocabulary;
use Tests\Support\Cases;
use Tests\TestCase;

uses(TestCase::class);

/*
 * Every hard name × every command shape, one test so the app boots once. Each command must be read as its command
 * and change exactly the tasks it names, among look-alike decoys, with no tie, new task or skip.
 */

/** Title as stored => name as typed. Hard on purpose: joiners, separators, month names, NFD accents, look-alikes. */
function matrixNames(): array
{
    return [
        'Annual sales report' => 'annual sales report',
        'Send_invoice' => 'send invoice',
        'Buy milk and eggs' => 'buy milk and eggs',
        'May' => 'May',
        'Mike' => 'Mike',
        Normalizer::normalize('Bài tập SQL', Normalizer::FORM_D) => 'bài tập sql',
        'Pack boxes' => 'pack boxes',
        'Gọi mẹ' => 'gọi mẹ',
        'Check-in online' => 'check-in online',
        'Sun lotion' => 'sun lotion',
        'March rally' => 'march rally',
        'Wed planning' => 'wed planning',
    ];
}

/** @return list<array{id: string, title: string, due_date: string}> */
function matrixTasks(): array
{
    $decoys = ['Report 1', 'Report 2', 'Sales call', 'Send 1', 'Send 2', 'Buyer red pencil', 'Buy milk', 'Eggs benedict recipe', 'Mike car service', 'Bài tập', 'Boxes for moving', 'Gọi bố', 'Online course', 'Lotion samples', 'Rally flyers', 'Planning poker'];
    $tasks = [];
    foreach ([...array_keys(matrixNames()), ...$decoys] as $index => $title) {
        // A far Wednesday, so every target below (Monday back, Friday on, an amount) changes it.
        $tasks[] = ['id' => 't'.$index, 'title' => (string) $title, 'due_date' => '2026-11-18'];
    }

    return $tasks;
}

/** @return array<string, array{string, CommandAction, list<string>}> command, action, titles it names */
function matrixCommands(): array
{
    $one = [
        'done {a}' => CommandAction::Complete, '{a} xong rồi' => CommandAction::Complete, 'xong {a}' => CommandAction::Complete,
        'cancel {a}' => CommandAction::Delete, 'xóa {a}' => CommandAction::Delete,
        'move {a} to friday' => CommandAction::Reschedule, 'dời {a} sang thứ 6' => CommandAction::Reschedule,
        'move {a} to tomorrow before friday' => CommandAction::Reschedule, 'move {a} to tuesday or friday' => CommandAction::Reschedule,
        'push {a} by 2 days' => CommandAction::Reschedule, 'lùi {a} 1 ngày' => CommandAction::Reschedule,
    ];
    $two = [
        'done {a} and {b}' => CommandAction::Complete, 'xóa {a} và {b}' => CommandAction::Delete,
        'move {a} and {b} to friday' => CommandAction::Reschedule, 'dời {a} và {b} sang thứ 6' => CommandAction::Reschedule,
        'move {a}, {b} to friday' => CommandAction::Reschedule,
        'move {a} to friday and {b} by 2 days' => CommandAction::Reschedule, 'push {a} by 1 day and {b} to monday' => CommandAction::Reschedule,
    ];
    $cases = [];
    foreach (matrixNames() as $title => $name) {
        foreach ($one as $template => $action) {
            $command = str_replace('{a}', $name, $template);
            $cases[$command] = [$command, $action, [(string) $title]];
        }
        foreach (matrixNames() as $otherTitle => $other) {
            if ($otherTitle === $title) {
                continue;
            }
            foreach ($two as $template => $action) {
                $command = str_replace(['{a}', '{b}'], [$name, $other], $template);
                $cases[$command] = [$command, $action, [(string) $title, (string) $otherTitle]];
            }
        }
    }

    return $cases;
}

it('reads every command shape about every hard name and changes exactly the tasks it names', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $tasks = matrixTasks();
    $titles = array_column($tasks, 'title', 'id');

    expect(Cases::failing(matrixCommands(), function (string $command, CommandAction $action, array $named) use ($context, $tasks, $titles): ?array {
        $read = app(ItemClassifier::class)->classify($command, $context);
        if ($read->action !== $action) {
            return ['read as' => $read->kind->value.'/'.($read->action->value ?? '-')];
        }
        $matches = app(CommandMatcher::class)->matchEach($command, $action, $tasks, [], $context);
        $changed = array_map(fn ($match): string => $match->change === null ? ($match->skip->value ?? 'new task') : $titles[$match->change->taskId], $matches);
        $ties = array_filter($matches, fn ($match): bool => $match->isTie());
        sort($changed);
        sort($named);
        // Every name also brings its own candidates: some word group lies within its title.
        $groups = app(CommandMatcher::class)->candidateWords($command, $context);
        $unfetched = array_filter($named, fn (string $title): bool => array_filter($groups, fn (array $words): bool => $words !== [] && array_diff($words, NoteVocabulary::tokens($title)) === []) === []);

        return $changed === $named && $ties === [] && $unfetched === [] ? null : ['changed' => $changed, 'ties' => count($ties), 'unfetched' => array_values($unfetched)];
    }))->toBe([]);
});

/** @return array<string, array{string, array<string, string|null>}> command, fields it must set */
function shiftCommands(): array
{
    $later30 = ['start_time' => '09:30', 'end_time' => '10:00'];
    $earlier30 = ['start_time' => '08:30', 'end_time' => '09:00'];
    $vnLater2h = ['start_time' => '11:00', 'end_time' => '12:00'];
    $vnLater30 = ['start_time' => '09:30', 'end_time' => '10:30'];
    $vnEarlier30 = ['start_time' => '08:30', 'end_time' => '09:30'];
    $vnEarlier1h = ['start_time' => '08:00', 'end_time' => '09:00'];
    $cases = [
        // Later, English: the amount after "by", alone, or with a direction before or after it.
        'push standup by 30 minutes' => $later30, 'push standup 30 minutes later' => $later30, 'push back standup 30 minutes' => $later30,
        'push standup back by 30 minutes' => $later30, 'move standup later by 30 minutes' => $later30, 'delay standup by half an hour' => $later30,
        'push standup thirty minutes' => $later30, 'push standup by 30 mins' => $later30, 'bump standup half an hour later' => $later30,
        // Earlier, English.
        'move standup earlier by 30 minutes' => $earlier30, 'move standup 30 minutes earlier' => $earlier30, 'move standup up 30 minutes' => $earlier30,
        'move up standup by half an hour' => $earlier30, 'shift standup 30 minutes earlier' => $earlier30, 'move standup forward by 30 minutes' => $earlier30,
        'move standup sooner by 30 minutes' => $earlier30,
        // Later, Vietnamese, with every hour word.
        'lùi họp nhóm 2 giờ' => $vnLater2h, 'lùi họp nhóm 2 tiếng' => $vnLater2h, 'lùi họp nhóm 2h' => $vnLater2h, 'lùi lại họp nhóm 2 tiếng' => $vnLater2h,
        'lùi họp nhóm hai tiếng' => $vnLater2h, 'dời họp nhóm thêm 30 phút' => $vnLater30, 'đẩy họp nhóm 30 phút nữa' => $vnLater30,
        'dời họp nhóm muộn hơn 30 phút' => $vnLater30, 'dời họp nhóm trễ 30 phút' => $vnLater30, 'lùi họp nhóm nửa tiếng' => $vnLater30,
        'lùi họp nhóm 30p' => $vnLater30, 'dời họp nhóm 30 phút sau' => $vnLater30,
        // Earlier, Vietnamese.
        'dời họp nhóm lên 30 phút' => $vnEarlier30, 'dời họp nhóm sớm hơn 30 phút' => $vnEarlier30, 'dịch họp nhóm sớm 30 phút' => $vnEarlier30,
        'dời sớm họp nhóm 30 phút' => $vnEarlier30, 'kéo họp nhóm lên 1 tiếng' => $vnEarlier1h, 'dời họp nhóm 1 giờ sớm hơn' => $vnEarlier1h,
        // Days and weeks move the date and keep the times; a task without a time moves its date.
        'push standup by 2 days' => ['due_date' => '2026-11-20'], 'lùi họp nhóm 2 ngày' => ['due_date' => '2026-11-20'],
        'dời họp nhóm sớm 1 ngày' => ['due_date' => '2026-11-17'], 'delay standup a week' => ['due_date' => '2026-11-25'],
        'lùi họp nhóm 1 tuần' => ['due_date' => '2026-11-25'], 'push gym by 3 days' => ['due_date' => '2026-11-21'],
        'lùi gym nửa ngày' => [],
        // A when after "to / sang" is a time, never an amount.
        'dời họp nhóm sang 2 giờ' => ['start_time' => '02:00', 'end_time' => '03:00'],
    ];

    return array_combine(array_keys($cases), array_map(fn (string $command, array $fields): array => [$command, $fields], array_keys($cases), $cases));
}

it('moves by every amount, unit and direction wording, English and Vietnamese', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    $tasks = [
        ['id' => 'standup', 'title' => 'Standup', 'due_date' => '2026-11-18', 'start_time' => '09:00', 'end_time' => '09:30'],
        ['id' => 'hop', 'title' => 'Họp nhóm', 'due_date' => '2026-11-18', 'start_time' => '09:00', 'end_time' => '10:00'],
        ['id' => 'gym', 'title' => 'Gym', 'due_date' => '2026-11-18'],
    ];

    expect(Cases::failing(shiftCommands(), function (string $command, array $fields) use ($context, $tasks): ?array {
        $read = app(ItemClassifier::class)->classify($command, $context);
        $match = app(CommandMatcher::class)->match($command, CommandAction::Reschedule, $tasks, [], $context);
        $got = $match->change?->fields ?? [];

        return $read->action === CommandAction::Reschedule && $got === $fields ? null : ['read as' => $read->kind->value, 'fields' => $got, 'skip' => $match->skip?->value];
    }))->toBe([]);
});
