<?php

use App\Services\Clock\ReminderCalculator;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\NoteContext;
use App\Services\Notes\NoteDateParser;
use App\Services\Notes\NoteTimeParser;

function noteExtractor(): FieldExtractor
{
    return new FieldExtractor(new NoteDateParser, new NoteTimeParser, new ReminderCalculator);
}

it('extracts English and accented Vietnamese fields (T-NU-10–18)', function (string $text, array $expected) {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh', ['sql' => 'SQL Course', 'web' => 'Adv Web', 'personal' => 'Personal']);
    $actual = noteExtractor()->extract($text, $context);
    foreach ($expected as $field => $value) {
        expect($actual[$field])->toBe($value, $field);
    }
})->with([
    ['sql quiz monday 9am', ['title' => 'SQL quiz', 'due_date' => '2026-10-26', 'start_time' => '09:00', 'priority' => 'high', 'project_id' => 'sql', 'reminder' => '1d']],
    ['call mum day after tomorrow', ['title' => 'Call mum', 'due_date' => '2026-10-25']],
    ['gọi mẹ ngày mốt', ['title' => 'Gọi mẹ', 'due_date' => '2026-10-25']],
    ['học bài thứ bảy lúc 2 giờ chiều', ['title' => 'Học bài', 'due_date' => '2026-10-24', 'start_time' => '14:00']],
    ['call mum this evening', ['title' => 'Call mum', 'start_time' => '19:00']],
    ['call mum evening', ['start_time' => '19:00']],
    ['gọi mẹ không gấp', ['title' => 'Gọi mẹ', 'priority' => 'low']],
    ['study 31/2', ['due_date' => null, 'low_confidence' => true]],
    ['read chapter 5 in 3 days', ['title' => 'Read chapter 5', 'due_date' => '2026-10-26', 'start_time' => null]],
    ['gym every monday 7am', ['title' => 'Gym', 'repeat' => 'weekly', 'due_date' => '2026-10-26']],
    ['meet 2-4pm', ['start_time' => '14:00', 'end_time' => '16:00']],
    ['meet Oct 26', ['title' => 'Meet', 'due_date' => '2026-10-26']],
    ['read adv web database', ['title' => 'Read Adv Web database', 'project_id' => 'web']],
]);

it('honors week start and note local time (T-NU-110)', function () {
    $context = new NoteContext(new DateTimeImmutable('2026-10-23T22:00:00+07:00'), 'Asia/Ho_Chi_Minh', [], 'sunday');
    expect(noteExtractor()->extract('read next week', $context)['due_date'])->toBe('2026-10-25');
    expect(noteExtractor()->extract('read tonight', $context)['start_time'])->toBeNull();
    expect(noteExtractor()->extract('read tomorrow 9am', $context)['reminder'])->toBe('15m');
});
