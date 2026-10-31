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
    $tasks = [];
    foreach (array_column(RealisticNotes::all(), 0) as $n => $note) {
        foreach (taskItems($note) as $i => $item) {
            $fields = app(FieldExtractor::class)->extract($item, RealisticNotes::context());
            $tasks[$item] = ['id' => "n{$n}i{$i}", 'title' => $fields->title, 'due_date' => $fields->dueDate, 'start_time' => $fields->startTime, 'end_time' => $fields->endTime];
        }
    }

    return $tasks;
}

/** @return array<int, string> the items of the note read as tasks */
function taskItems(string $note): array
{
    $context = RealisticNotes::context();
    $items = app(NoteSplitter::class)->split($note, array_values($context->projects));

    return array_filter($items, fn (string $item): bool => app(ItemClassifier::class)->classify($item, $context)->kind === ItemKind::Task);
}

/**
 * The ways people write a command about one task, with the action each one means.
 *
 * @return list<array{string, CommandAction}>
 */
function commandWordings(string $item): array
{
    // Not "{$item} done": after a task verb that is a task ("get it done", NU §2.3).
    $complete = ["done {$item}", "Done {$item}!", "{$item} - done", "{$item}: done", "xong {$item}", "{$item} xong rồi", "đã hoàn thành {$item}", 'DONE '.mb_strtoupper($item), '  done   '.mb_strtolower($item).'  '];
    $delete = ["hủy {$item}", "cancel {$item}", "delete {$item}.", "xóa {$item}"];
    $move = ["move {$item} to friday", "dời {$item} sang thứ 6", "push {$item} to tomorrow 4pm", "reschedule {$item} to 10am", "postpone {$item} to next week", "lùi {$item} sang ngày 25", "move {$item} to 11/20"];

    return [
        ...array_map(fn (string $command): array => [$command, CommandAction::Complete], $complete),
        ...array_map(fn (string $command): array => [$command, CommandAction::Delete], $delete),
        ...array_map(fn (string $command): array => [$command, CommandAction::Reschedule], $move),
    ];
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

it('turns every item of a task note into a task, never a lost command or a skip', function (string $note) {
    $context = RealisticNotes::context();
    $lost = [];
    foreach (app(NoteSplitter::class)->split($note, array_values($context->projects)) as $item) {
        $read = app(ItemClassifier::class)->classify($item, $context);
        // A delete verb with a deadline ("cancel netflix before the 10th") is a task when no task matches.
        $becomesTask = $read->kind === ItemKind::Task
            || ($read->action === CommandAction::Delete && matchAmongRealistic($item, CommandAction::Delete, [])->newTask !== null);
        if (! $becomesTask) {
            $lost[] = "\"{$item}\" read as {$read->kind->value}/".($read->action->value ?? '-');
        }
    }

    expect($lost)->toBe([]);
})->with(RealisticNotes::tasks());

it('reads each command wording as its command and finds the task it names', function (string $note) {
    $tasks = realisticTasks();
    $context = RealisticNotes::context();
    $problems = [];
    foreach (taskItems($note) as $item) {
        foreach (commandWordings($item) as [$command, $action]) {
            $read = app(ItemClassifier::class)->classify($command, $context);
            if ($read->kind !== ItemKind::Command || $read->action !== $action) {
                $problems[] = "\"{$command}\" read as {$read->kind->value}/".($read->action->value ?? '-');
            }
            $match = matchAmongRealistic($command, $action, $tasks);
            // A reschedule the task already has is skipped; anything else must find the task.
            if (! foundTask($match, $tasks[$item]['id']) && ! ($action === CommandAction::Reschedule && $match->skip !== null)) {
                $problems[] = "\"{$command}\" missed {$tasks[$item]['title']}";
            }
        }
    }

    expect($problems)->toBe([]);
})->with(RealisticNotes::all());

it('reschedules only what the target states, never leaves a time without a date, and is idempotent', function (string $note) {
    $tasks = realisticTasks();
    $context = RealisticNotes::context();
    $problems = [];
    foreach (taskItems($note) as $item) {
        $task = $tasks[$item];
        // A date alone keeps the times; a time alone keeps the date, and gives one only to a task without (NU-E35, NU-E5).
        $timeOnly = $task['due_date'] === null ? ['due_date', 'start_time', 'end_time'] : ['start_time', 'end_time'];
        $both = ['due_date', 'start_time', 'end_time'];
        foreach (['to friday' => ['due_date'], 'sang ngày 5' => ['due_date'], 'to 11/20' => ['due_date'], 'to next week' => ['due_date'], 'to 10am' => $timeOnly, 'sang 14h' => $timeOnly, 'to tomorrow 4pm' => $both] as $target => $allowed) {
            $command = "move {$item} {$target}";
            $match = matchAmongRealistic($command, CommandAction::Reschedule, $tasks);
            if ($match->change?->taskId !== $task['id']) {
                continue;
            }
            $fields = $match->change->fields;
            if (array_diff(array_keys($fields), $allowed) !== []) {
                $problems[] = "\"{$command}\" changed more than it states: ".json_encode($fields);
            }
            $moved = [...$task, ...$fields];
            if ($moved['start_time'] !== null && $moved['due_date'] === null) {
                $problems[] = "\"{$command}\" left a time without a date (NU-E5)";
            }
            $again = app(CommandMatcher::class)->match($command, CommandAction::Reschedule, array_values([...$tasks, $item => $moved]), [], $context);
            if ($again->change?->taskId === $task['id']) {
                $problems[] = "\"{$command}\" changed the task again: ".json_encode($again->change->fields);
            }
        }
    }

    expect($problems)->toBe([]);
})->with(RealisticNotes::all());
