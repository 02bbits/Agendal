<?php

use App\Enums\ItemKind;
use App\Enums\WeekStart;
use App\Services\Notes\CommandMatcher;
use App\Services\Notes\ExtractedFields;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\ItemClassifier;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteSplitter;
use Tests\TestCase;

uses(TestCase::class);

/*
 * Try notes by hand: edit tests/Manual/notes.txt, then run
 *   php vendor/bin/pest tests/Manual
 * Every note prints what the engine makes of it. A note with "=> expected" fails when the output doesn't contain it.
 * Not in phpunit.xml, so CI never runs it.
 */

/** "Report | 2026-10-26 | 09:00-10:00" → a task row. */
function manualTask(string $id, string $line, bool $done): array
{
    [$title, $date, $times] = array_pad(array_map(trim(...), explode('|', $line)), 3, '');
    [$start, $end] = array_pad(explode('-', $times), 2, null);

    return ['id' => $id, 'title' => $title, 'due_date' => $date ?: null, 'start_time' => $start ?: null, 'end_time' => $end ?: null, 'done' => $done];
}

function manualFields(ExtractedFields $fields): string
{
    $when = trim(($fields->dueDate ?? 'no date').' '.$fields->startTime.($fields->endTime ? '-'.$fields->endTime : ''));

    return "\"{$fields->title}\" {$when}";
}

it('prints what the engine makes of each note in notes.txt', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh');
    [$open, $done, $failures, $out] = [[], [], [], []];

    foreach (file(__DIR__.'/notes.txt', FILE_IGNORE_NEW_LINES) ?: [] as $number => $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if ($line === '---') {
            [$open, $done] = [[], []];
            $out[] = '';

            continue;
        }
        if (preg_match('~^now:\s*(\S+)\s+(\S+)(?:\s+(mon|sun))?$~', $line, $m) === 1) {
            $context = new NoteContext(new DateTimeImmutable($m[1]), $m[2], weekStart: WeekStart::from($m[3] ?? 'mon'));

            continue;
        }
        if (preg_match('~^(task|done):\s*(.+)$~', $line, $m) === 1) {
            $id = 't'.(count($open) + count($done) + 1);
            $m[1] === 'task' ? $open[] = manualTask($id, $m[2], false) : $done[] = manualTask($id, $m[2], true);

            continue;
        }

        [$note, $expected] = array_pad(array_map(trim(...), explode('=>', $line, 2)), 2, null);
        $titles = array_column([...$open, ...$done], 'title', 'id');
        $results = [];
        foreach (app(NoteSplitter::class)->split($note) as $item) {
            $kind = app(ItemClassifier::class)->classify($item, $context);
            $results[] = match ($kind->kind) {
                ItemKind::Skip => 'skip',
                ItemKind::Task => 'task '.manualFields(app(FieldExtractor::class)->extract($item, $context)),
                ItemKind::Command => $kind->action->value.' → '.implode(' + ', array_map(function ($match) use ($titles): string {
                    $what = match (true) {
                        $match->change !== null => '"'.$titles[$match->change->taskId].'" '.json_encode($match->change->fields ?: ($match->change->delete ? 'deleted' : []), JSON_UNESCAPED_UNICODE).' label "'.$match->change->label.'"'.($match->change->was === null ? '' : ' was "'.$match->change->was.'"'),
                        $match->newTask !== null => 'new task '.manualFields($match->newTask),
                        default => 'skip '.$match->skip?->value,
                    };

                    return $what.($match->isTie() ? ' · tie: '.implode(', ', array_map(fn (string $id): string => $titles[$id], $match->tiedTaskIds)) : '');
                }, app(CommandMatcher::class)->matchEach($item, $kind->action, $open, $done, $context))),
            };
        }
        $result = implode(' | ', $results);
        $mark = $expected === null ? ' ' : (str_contains($result, $expected) ? '✓' : '✗');
        $out[] = "{$mark} {$note}\n    {$result}".($mark === '✗' ? "\n    expected: {$expected}" : '');
        if ($mark === '✗') {
            $failures[] = 'line '.($number + 1).": {$note}";
        }
    }

    fwrite(STDOUT, "\n".implode("\n", $out)."\n");
    expect($failures)->toBe([]);
});
