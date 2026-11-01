<?php

use App\Enums\Priority;
use App\Enums\Repeat;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\NoteContext;
use Tests\Support\Cases;
use Tests\TestCase;

uses(TestCase::class);

/*
 * URLs, emails, file names and project names are kept as written: every one of them in every position, with and
 * without a real when, must stay whole in the title and give no date, time, repeat or priority of its own.
 */

/** @return array<string, string> project id => name; each looks like a field on purpose */
function literalProjects(): array
{
    return ['daily' => 'Daily', 'friday' => 'Friday', 'urgent' => 'Urgent', 'next' => 'Next Week'];
}

/** @return list<string> */
function literalTexts(): array
{
    return [
        'https://example.com/2026/10/26', 'https://example.com/meet/10:30', 'https://example.com/sql/report.pdf',
        'www.example.com/friday-urgent', 'finance26-10-2026@example.com', 'report_2026-10-26.pdf', 'notes.daily.md',
        'tomorrow.txt',
    ];
}

/** @return array<string, array{string, string, ?string, ?string, ?string}> note, literal, due, start, project id */
function literalNotes(): array
{
    // {L} is the literal; the rest of each template is the only when the note states.
    $templates = [
        'read {L}' => [null, null], 'read {L} tomorrow 9am' => ['2026-10-24', '09:00'], 'tomorrow 9am read {L}' => ['2026-10-24', '09:00'],
        'đọc {L} ngày mai' => ['2026-10-24', null], 'send {L} to boss on monday' => ['2026-10-26', null],
    ];
    $cases = [];
    foreach (literalTexts() as $literal) {
        foreach ($templates as $template => [$due, $start]) {
            $note = str_replace('{L}', $literal, $template);
            $cases[$note] = [$note, $literal, $due, $start, null];
        }
    }
    foreach (literalProjects() as $id => $name) {
        foreach (['call mom for project {P}' => null, 'call mom for project {P} on monday' => '2026-10-26', '{P}: call mom' => null] as $template => $due) {
            $note = str_replace('{P}', $name, $template);
            $cases[$note] = [$note, $name, $due, null, $id];
        }
    }

    return $cases;
}

it('keeps every URL, email, file and project name whole and reads no field from it', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh', literalProjects());

    expect(Cases::failing(literalNotes(), function (string $note, string $literal, ?string $due, ?string $start, ?string $project) use ($context): ?array {
        $fields = app(FieldExtractor::class)->extract($note, $context);
        $got = [str_contains($fields->title, $literal), $fields->dueDate, $fields->startTime, $fields->repeat, $fields->priority === Priority::High, $fields->projectId];

        return $got === [true, $due, $start, Repeat::Never, false, $project] ? null : ['title' => $fields->title, 'due' => $fields->dueDate, 'start' => $fields->startTime, 'repeat' => $fields->repeat->value, 'priority' => $fields->priority->value, 'project' => $fields->projectId];
    }))->toBe([]);
});
