<?php

use App\Enums\CommandAction;
use App\Enums\ItemKind;
use App\Services\Notes\CommandMatch;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\ItemClassifier;
use App\Services\Notes\NoteSplitter;
use Tests\Support\RealisticNotes;
use Tests\TestCase;

uses(TestCase::class);

/**
 * Every task item of the realistic notes as a task row, keyed by the item text: the user's whole task list,
 * so each command is matched among many look-alikes as in real use.
 *
 * @return array<string, array{id: string, title: string, due_date: ?string, start_time: ?string, end_time: ?string}>
 */
function realisticTasks(): array
{
    static $tasks = null;
    if ($tasks !== null) {
        return $tasks;
    }
    $context = RealisticNotes::context();
    $tasks = [];
    foreach (array_column(RealisticNotes::dataset(), 0) as $n => $note) {
        foreach (app(NoteSplitter::class)->split($note, array_values($context->projects)) as $i => $item) {
            if (app(ItemClassifier::class)->classify($item, $context)->kind === ItemKind::Task) {
                $fields = app(FieldExtractor::class)->extract($item, $context);
                $tasks[$item] = ['id' => "n{$n}i{$i}", 'title' => $fields->title, 'due_date' => $fields->dueDate, 'start_time' => $fields->startTime, 'end_time' => $fields->endTime];
            }
        }
    }

    return $tasks;
}

function matchAmongRealistic(string $command, CommandAction $action, array $tasks): CommandMatch
{
    return app(CommandMatcher::class)->match($command, $action, array_values($tasks), [], RealisticNotes::context());
}

/** The command found this task: as the change, or among the tied choices when titles repeat. */
function foundTask(CommandMatch $match, string $id): bool
{
    return $match->change?->taskId === $id || ($match->isTie() && in_array($id, $match->tiedTaskIds, true));
}

it('finds the task a command names in the words it was created from', function (string $note) {
    $tasks = realisticTasks();
    expect($tasks)->not->toBeEmpty();
    foreach (array_keys($tasks) as $item) {
        if (! str_contains($note, $item)) {
            continue;
        }
        $id = $tasks[$item]['id'];
        foreach (["done {$item}", "{$item} done", "xóa {$item}"] as $command) {
            $action = str_starts_with($command, 'xóa') ? CommandAction::Delete : CommandAction::Complete;
            expect(foundTask(matchAmongRealistic($command, $action, $tasks), $id))->toBeTrue("\"{$command}\" missed {$tasks[$item]['title']}");
        }
    }
})->with(RealisticNotes::dataset());

it('reschedules only what the target states, never leaves a time without a date, and is idempotent', function (string $note) {
    $tasks = realisticTasks();
    expect($tasks)->not->toBeEmpty();
    $context = RealisticNotes::context();
    foreach (array_keys($tasks) as $item) {
        if (! str_contains($note, $item)) {
            continue;
        }
        $task = $tasks[$item];
        // A date alone keeps the times; a time alone keeps the date, and gives one only to a task without (NU-E35, NU-E5).
        $timeOnly = $task['due_date'] === null ? ['due_date', 'start_time', 'end_time'] : ['start_time', 'end_time'];
        foreach (['to friday' => ['due_date'], 'sang ngày 5' => ['due_date'], 'to 10am' => $timeOnly, 'to tomorrow 4pm' => ['due_date', 'start_time', 'end_time']] as $target => $allowed) {
            $command = "move {$item} {$target}";
            $match = matchAmongRealistic($command, CommandAction::Reschedule, $tasks);
            expect(foundTask($match, $task['id']) || $match->skip !== null)->toBeTrue("\"{$command}\" missed {$task['title']}");
            if ($match->change?->taskId !== $task['id']) {
                continue;
            }
            $fields = $match->change->fields;
            expect(array_values(array_diff(array_keys($fields), $allowed)))->toBe([], "\"{$command}\" changed more than it states");
            $moved = [...$task, ...$fields];
            expect($moved['start_time'] === null || $moved['due_date'] !== null)->toBeTrue("\"{$command}\" left a time without a date (NU-E5)");
            $again = app(CommandMatcher::class)->match($command, CommandAction::Reschedule, array_values([...$tasks, $item => $moved]), [], $context);
            expect($again->change?->taskId)->not->toBe($task['id'], "\"{$command}\" changed the task again");
        }
    }
})->with(RealisticNotes::dataset());
