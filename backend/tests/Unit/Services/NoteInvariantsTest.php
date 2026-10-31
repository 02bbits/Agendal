<?php

use App\Services\Notes\ExtractedFields;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\NoteContext;
use Tests\Support\NoteInvariants;
use Tests\Support\NoteRules;
use Tests\Support\RealisticNotes;
use Tests\TestCase;

uses(TestCase::class);

function invariantContext(): NoteContext
{
    return RealisticNotes::context();
}

function invariantFields(string $text): ExtractedFields
{
    return app(FieldExtractor::class)->extract($text, invariantContext());
}

/** @return array{string|null, string|null, string} due date, start time and title, the parts a rewording must keep */
function meaning(string $text): array
{
    $fields = invariantFields($text);

    return [$fields->dueDate, $fields->startTime, mb_strtolower($fields->title)];
}

it('keeps every property on realistic notes', function (string $note) {
    expect(app(NoteInvariants::class)->violations($note, invariantContext()))->toBe([]);
})->with(RealisticNotes::all());

/** @return array<string, array{string, string}> every month phrase of the CSV in each date order people write */
function monthWordings(): array
{
    $cases = [];
    foreach (NoteRules::rows() as [$category, $phrase]) {
        if (preg_match('/^month:(\d+)$/', $category, $month) !== 1) {
            continue;
        }
        $due = sprintf('2027-%02d-26', (int) $month[1]);
        foreach (["pay rent {$phrase} 26, 2027", "pay rent on {$phrase} 26 2027", "pay rent 26 {$phrase} 2027", "pay rent on the 26th of {$phrase} 2027"] as $note) {
            $cases[$note] = [$note, $due];
        }
    }

    return $cases;
}

it('reads a month name in any order as the same date (M1)', function (string $note, string $due) {
    expect(meaning($note))->toBe([$due, null, 'pay rent'])
        ->and(meaning((new DateTimeImmutable($due))->format('d/m/Y').' pay rent'))->toBe([$due, null, 'pay rent']);
})->with(monthWordings());

it('reads the same note whatever the phrase order (M2)', function (string $reordered) {
    expect(meaning($reordered))->toBe(meaning('pay rent tomorrow at 9am'));
})->with(['tomorrow at 9am pay rent', 'pay rent at 9am tomorrow', 'at 9am tomorrow pay rent', 'tomorrow pay rent at 9am']);

it('reads the same note whatever the case, spacing or politeness (M3)', function (string $variant) {
    expect(meaning($variant))->toBe(meaning('pay rent tomorrow at 9am'));
})->with(['PAY RENT TOMORROW AT 9AM', 'Pay Rent Tomorrow At 9am', '  pay   rent  tomorrow   at 9am ', 'please pay rent tomorrow at 9am', 'remind me to pay rent tomorrow at 9am']);

/** @return array<string, array{int}> */
function clockHours(): array
{
    $hours = [...range(7, 11), ...range(13, 23)];

    return array_combine(array_map(fn (int $hour): string => "at {$hour}", $hours), array_map(fn (int $hour): array => [$hour], $hours));
}

it('reads "at H" as "at H:00" (M4)', function (int $hour) {
    expect(meaning("call John at {$hour}"))->toBe(meaning("call John at {$hour}:00"));
})->with(clockHours());
