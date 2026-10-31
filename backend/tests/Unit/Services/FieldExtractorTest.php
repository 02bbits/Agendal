<?php

use App\Enums\WeekStart;
use App\Services\Notes\ExtractedFields;
use App\Services\Notes\FieldExtractor;
use App\Services\Notes\NoteContext;
use Tests\Support\NoteExtractionScenarios;
use Tests\TestCase;

uses(TestCase::class);

/** Friday 23 Oct 2026, 08:12 in Ho Chi Minh City, as in the note corpus. */
const EXTRACTOR_NOW = '2026-10-23T08:12:00+07:00';

/** @param array<string, string> $projects */
function extractFields(string $text, array $projects = ['sql' => 'SQL Course', 'web' => 'Adv Web', 'hci' => 'HCI', 'personal' => 'Personal'], string $now = EXTRACTOR_NOW, WeekStart $weekStart = WeekStart::Monday): ExtractedFields
{
    $extractor = app(FieldExtractor::class);

    return $extractor->extract($text, new NoteContext(new DateTimeImmutable($now), 'Asia/Ho_Chi_Minh', $projects, $weekStart));
}

/** The fields named in $expected, with enums as their stored values, in a stable order. */
function selectedFields(ExtractedFields $fields, array $expected): array
{
    $values = array_map(fn (mixed $value): mixed => $value instanceof BackedEnum ? $value->value : $value, get_object_vars($fields));
    $selected = array_intersect_key($values, $expected);
    ksort($selected);

    return $selected;
}

function sortedFields(array $expected): array
{
    ksort($expected);

    return $expected;
}

dataset('extraction rules', function (): array {
    // Datasets build before the app boots, so read the config file directly.
    $config = require __DIR__.'/../../../config/notes.php';

    return NoteExtractionScenarios::generate($config['rules']);
});

it('reads every extraction rule in the shared rules CSV', function (string $note, array $expected, string $now) {
    expect(selectedFields(extractFields($note, [], $now), $expected))->toBe(sortedFields($expected));
})->with('extraction rules');

it('extracts English and accented Vietnamese fields (T-NU-10–18)', function (string $text, array $expected) {
    expect(selectedFields(extractFields($text), $expected))->toBe(sortedFields($expected));
})->with([
    ['sql quiz monday 9am', ['title' => 'SQL quiz', 'dueDate' => '2026-10-26', 'startTime' => '09:00', 'priority' => 'high', 'projectId' => 'sql', 'reminder' => '1d']],
    ['call mum day after tomorrow', ['title' => 'Call mum', 'dueDate' => '2026-10-25']],
    ['gọi mẹ ngày mốt', ['title' => 'Gọi mẹ', 'dueDate' => '2026-10-25']],
    ['học bài thứ bảy lúc 2 giờ chiều', ['title' => 'Học bài', 'dueDate' => '2026-10-24', 'startTime' => '14:00']],
    ['call mum this evening', ['title' => 'Call mum', 'startTime' => '19:00']],
    ['call mum evening', ['startTime' => '19:00']],
    ['gọi mẹ không gấp', ['title' => 'Gọi mẹ', 'priority' => 'low']],
    ['study 31/2', ['dueDate' => null, 'lowConfidence' => true]],
    ['take medicine at 8am and 8pm', ['title' => 'Take medicine', 'startTime' => '08:00', 'lowConfidence' => true]],
    ['meet at 9am, 9am sharp', ['startTime' => '09:00', 'lowConfidence' => false]],
    ['pay rent on the 26th of October 2027', ['title' => 'Pay rent', 'dueDate' => '2027-10-26']],
    ['buy flowers for mom bday 11/15', ['title' => 'Buy flowers for mom bday', 'dueDate' => '2026-11-15']],
    ['renew lease 12/31/2026', ['title' => 'Renew lease', 'dueDate' => '2026-12-31']],
    ['call bank 5/11', ['dueDate' => '2026-11-05']],
    ['đóng học phí trước ngày 10.', ['title' => 'Đóng học phí', 'dueDate' => '2026-11-10']],
    ['nộp bài ngày 10 - gấp', ['title' => 'Nộp bài', 'dueDate' => '2026-11-10', 'priority' => 'high']],
    'a day range is no single date' => ['họp ngày 10-11', ['dueDate' => null]],
    ['renew lease until friday', ['title' => 'Renew lease', 'dueDate' => '2026-10-30']],
    ['nộp báo cáo chậm nhất thứ 6', ['title' => 'Nộp báo cáo', 'dueDate' => '2026-10-30']],
    ['read chapter 5 in 3 days', ['title' => 'Read chapter 5', 'dueDate' => '2026-10-26', 'startTime' => null]],
    ['đọc sách 3 ngày nữa', ['title' => 'Đọc sách', 'dueDate' => '2026-10-26']],
    ['read in a week', ['title' => 'Read', 'dueDate' => '2026-10-30']],
    ['mai hop nhom 9h', ['title' => 'Mai hop nhom', 'dueDate' => '2026-10-23', 'startTime' => '09:00', 'lowConfidence' => true]],
    ['đi chợ chiều nay', ['title' => 'Đi chợ', 'startTime' => '15:00', 'projectId' => null]],
    ['gym every monday 7am', ['title' => 'Gym', 'repeat' => 'weekly', 'dueDate' => '2026-10-26']],
    ['meet 2-4pm', ['startTime' => '14:00', 'endTime' => '16:00']],
    ['meet Oct 26', ['title' => 'Meet', 'dueDate' => '2026-10-26']],
    ['read adv web database', ['title' => 'Read Adv Web database', 'projectId' => 'web']],
]);

it('follows the NU §2.5 rules and edge cases', function (string $text, array $expected) {
    expect(selectedFields(extractFields($text), $expected))->toBe(sortedFields($expected));
})->with([
    'NU-E2 bare weekday today → next week' => ['submit report friday', ['dueDate' => '2026-10-30']],
    'NU-E2 this weekday today → today' => ['submit report this friday', ['dueDate' => '2026-10-23']],
    'NU-E3 next weekday → the coming one' => ['call mum next monday', ['dueDate' => '2026-10-26']],
    'Vietnamese this weekday' => ['nộp bài thứ 6 này', ['dueDate' => '2026-10-23']],
    'NU-E4 recent past date stays' => ['pay rent 20 Oct', ['dueDate' => '2026-10-20']],
    'NU-E4 older date → next year' => ['pay rent 1 Sep', ['dueDate' => '2027-09-01']],
    'NU-E4 explicit year stays' => ['pay rent 1/9/2026', ['dueDate' => '2026-09-01']],
    'NU-E31 day/month' => ['read 3/4', ['dueDate' => '2027-04-03']],
    'Vietnamese named month' => ['nộp báo cáo 26 tháng 10', ['dueDate' => '2026-10-26']],
    'Vietnamese day word' => ['nộp báo cáo ngày 26/10', ['dueDate' => '2026-10-26', 'title' => 'Nộp báo cáo']],
    'NU-E5 passed time → tomorrow' => ['call mum 7am', ['dueDate' => '2026-10-24', 'startTime' => '07:00']],
    'NU-E6 later date wins' => ['study monday for quiz friday', ['dueDate' => '2026-10-30', 'title' => 'Study monday for quiz']],
    'NU-E6 by-date wins' => ['review slides tuesday by monday', ['dueDate' => '2026-10-26', 'title' => 'Review slides tuesday']],
    'NU-E7 bare 2 → afternoon' => ['meet at 2 tomorrow', ['startTime' => '14:00']],
    'NU-E7 bare 7 → morning' => ['meet at 7 tomorrow', ['startTime' => '07:00']],
    'NU-E7 bare 12 → noon' => ['meet at 12 tomorrow', ['startTime' => '12:00']],
    'Vietnamese hour and minutes' => ['họp 14h30', ['startTime' => '14:30']],
    'NU-E7 does not read an hour marker' => ['chạy bộ mỗi ngày 6h', ['startTime' => '06:00', 'dueDate' => '2026-10-24', 'repeat' => 'daily']],
    'ER is an acronym' => ['er diagram tmr', ['title' => 'ER diagram', 'dueDate' => '2026-10-24']],
    'decimal time' => ['meet 9.30', ['startTime' => '09:30']],
    'NU-E9 end of the month' => ['pay bills end of the month', ['dueDate' => '2026-10-31']],
    'end of the week (Monday start)' => ['clean room end of the week', ['dueDate' => '2026-10-25']],
    'NU-E10 next week' => ['học bài tuần sau', ['dueDate' => '2026-10-26']],
    'NU-E24 high beats low' => ['maybe urgent fix bug', ['priority' => 'high', 'title' => 'Fix bug']],
    'pure priority words leave the title' => ['high priority email boss', ['priority' => 'high', 'title' => 'Email boss']],
    'content priority words stay' => ['deadline report', ['priority' => 'high', 'title' => 'Deadline report']],
    'due today → medium' => ['call mum today', ['priority' => 'medium']],
    'NU-E21 project casing' => ['study adv web', ['title' => 'Study Adv Web', 'projectId' => 'web']],
    'NU-E23 unknown project' => ['study for chemistry', ['projectId' => null]],
    'NU-E25 exam reminder' => ['quiz tomorrow', ['reminder' => '1d']],
    'NU-E25 past reminder → none' => ['call mum 8:20am', ['reminder' => 'none']],
    'unsupported repeat is low' => ['gym every 2 weeks', ['repeat' => 'never', 'lowConfidence' => true]],
    'every other day is low' => ['gym every other day', ['lowConfidence' => true]],
    'Vietnamese repeat' => ['tập gym hằng tuần', ['repeat' => 'weekly', 'title' => 'Tập gym']],
    'lead-ins repeat' => ['please remember to buy milk', ['title' => 'Buy milk']],
    'acronyms' => ['update cv and ui', ['title' => 'Update CV and UI']],
    'Vietnamese hour with period' => ['nộp bài thứ 6 lúc 9h sáng', ['dueDate' => '2026-10-30', 'startTime' => '09:00']],
    'tonight' => ['họp nhóm tối nay', ['startTime' => '20:00', 'dueDate' => '2026-10-23', 'title' => 'Họp nhóm']],
    'trailing punctuation' => ['call mum asap!!', ['title' => 'Call mum']],
    'NU-E30 range takes the earlier start' => ['meet 10-2pm', ['startTime' => '10:00', 'endTime' => '14:00']],
    'NU-E30 from … to' => ['meet from 2 to 4', ['startTime' => '14:00', 'endTime' => '16:00']],
    'number range is no time' => ['read pages 10-20', ['startTime' => null, 'endTime' => null]],
    'count range is no time' => ['buy 3-4 eggs', ['startTime' => null]],
    'tối ưu is no time' => ['tối ưu code', ['startTime' => null, 'title' => 'Tối ưu code']],
    'sáng tạo is no time' => ['viết bài sáng tạo', ['startTime' => null]],
    'chiều dài is no time' => ['đo chiều dài bàn', ['startTime' => null]],
    'a name after a title is no date' => ['gặp chị Mai', ['dueDate' => null, 'title' => 'Gặp chị Mai', 'lowConfidence' => true]],
    'unreadable time is low' => ['call mum 3pmish', ['lowConfidence' => true]],
    'a lone noun is low' => ['report tomorrow', ['title' => 'Report', 'lowConfidence' => true]],
    'a lone verb still has a verb' => ['call tomorrow', ['title' => 'Call', 'lowConfidence' => false]],
    'NU-E28 other language is low' => ['comprar leche', ['lowConfidence' => true]],
    'NU-E40 unaccented Vietnamese is low' => ['toi can mua sua', ['lowConfidence' => true, 'title' => 'Toi can mua sua', 'dueDate' => null]],
]);

it('reads real notes the way a person means them', function (string $text, array $expected) {
    expect(selectedFields(extractFields($text), $expected))->toBe(sortedFields($expected));
})->with([
    'a day period gives am/pm to a range' => ['họp tối 7-9h', ['startTime' => '19:00', 'endTime' => '21:00', 'title' => 'Họp']],
    'day period words leave the title' => ['họp nhóm HCI chiều mai 2-4h', ['title' => 'Họp nhóm HCI', 'dueDate' => '2026-10-24', 'startTime' => '14:00', 'endTime' => '16:00']],
    'a 24-hour time ignores the day period' => ['họp nhóm chiều nay lúc 14h', ['startTime' => '14:00', 'lowConfidence' => false]],
    'several weekdays in one repeat are low' => ['đi gym 6h sáng mỗi thứ 3 và thứ 5', ['title' => 'Đi gym', 'repeat' => 'never', 'lowConfidence' => true]],
    'unsupported repeat leaves the title' => ['team standup 9:15-9:30 every weekday', ['title' => 'Team standup', 'lowConfidence' => true]],
    'day of this month' => ['trả tiền điện trước ngày 28', ['dueDate' => '2026-10-28', 'title' => 'Trả tiền điện', 'lowConfidence' => false]],
    'passed day → next month' => ['trả tiền nhà ngày 5', ['dueDate' => '2026-11-05']],
    'a count is no day' => ['uống thuốc ngày 2 lần', ['dueDate' => null]],
    'a plain number is no time' => ['đọc 28 trang', ['startTime' => null, 'lowConfidence' => false]],
    'weekend → Saturday' => ['maybe read a book this weekend', ['dueDate' => '2026-10-24', 'title' => 'Read a book', 'priority' => 'low']],
    'NU-E5 a passed bare hour → tomorrow' => ['call John at 7', ['dueDate' => '2026-10-24', 'startTime' => '07:00']],
    'Vietnamese mum keyword' => ['gọi mẹ tối nay', ['projectId' => 'personal']],
]);

it('keeps a yearless date within the grace days, counted in calendar days (NU-E4)', function (string $now, string $text, ?string $due) {
    expect(extractFields($text, [], $now)->dueDate)->toBe($due);
})->with([
    '30 days back across a 31-day month' => ['2026-03-01T08:00:00+07:00', 'pay 30/1', '2026-01-30'],
    '31 days back → next year' => ['2026-03-01T08:00:00+07:00', 'pay 29/1', '2027-01-29'],
    'leap year: 30 days back from 1 Mar' => ['2028-03-01T08:00:00+07:00', 'pay 31/1', '2028-01-31'],
    'leap day this year stays' => ['2028-03-15T08:00:00+07:00', 'pay 29/2', '2028-02-29'],
    'old leap day with no leap day next year → no date' => ['2028-12-01T08:00:00+07:00', 'pay 29/2', null],
    'no leap day this year → no date' => ['2027-03-01T08:00:00+07:00', 'pay 29/2', null],
    'last day of a 30-day month' => ['2026-10-23T08:00:00+07:00', 'pay 30/9', '2026-09-30'],
    '31 in a 30-day month → no date' => ['2026-10-23T08:00:00+07:00', 'pay 31/9', null],
]);

// Thursday 29 Oct 2026, 10:00, as in the IM-33 review.
it('reads the notes from the IM-33 review', function (string $text, array $expected) {
    expect(selectedFields(extractFields($text, ['portfolio' => 'Portfolio', 'hci' => 'HCI'], '2026-10-29T10:00:00+07:00'), $expected))->toBe(sortedFields($expected));
})->with([
    'an hour before tối nay leaves the title' => ['học bài lúc 8 giờ tối nay', ['title' => 'Học bài', 'startTime' => '20:00', 'dueDate' => '2026-10-29']],
    'the same with họp' => ['họp lúc 7 giờ tối nay', ['title' => 'Họp', 'startTime' => '19:00']],
    'a year after the month name' => ['Book flight Oct 26, 2026', ['title' => 'Book flight', 'dueDate' => '2026-10-26']],
    'NU-E5/E7 for a bare hour' => ['call John at 9', ['dueDate' => '2026-10-30', 'startTime' => '09:00']],
    'NU-E5/E7 with minutes' => ['call John at 9:30', ['dueDate' => '2026-10-30', 'startTime' => '09:30']],
    'English with a time is understood' => ['team meeting 3pm', ['lowConfidence' => false, 'startTime' => '15:00']],
    'a two-word Vietnamese task is whole' => ['đi chợ chiều nay', ['title' => 'Đi chợ', 'lowConfidence' => false]],
    'an English ordinal day' => ['pay rent on the 1st', ['dueDate' => '2026-11-01', 'title' => 'Pay rent']],
    'a relative time and remind me to' => ['remind me to call mom in 2 hours', ['title' => 'Call mom', 'dueDate' => '2026-10-29', 'startTime' => '12:00']],
]);

it('reads dates and times like the review cases', function (string $text, array $expected, string $now) {
    expect(selectedFields(extractFields($text, [], $now), $expected))->toBe(sortedFields($expected));
})->with([
    'tomorrow morning at an hour' => ['họp lúc 9 giờ sáng mai', ['title' => 'Họp', 'dueDate' => '2026-10-24', 'startTime' => '09:00'], EXTRACTOR_NOW],
    'weekday evening at an hour' => ['call mum friday evening at 7', ['title' => 'Call mum', 'dueDate' => '2026-10-30', 'startTime' => '19:00'], EXTRACTOR_NOW],
    'month name with ordinal and year' => ['submit report September 1st, 2027', ['title' => 'Submit report', 'dueDate' => '2027-09-01'], EXTRACTOR_NOW],
    'ordinal of month' => ['party 26th of December', ['title' => 'Party', 'dueDate' => '2026-12-26'], EXTRACTOR_NOW],
    'month name before a day, within the grace days' => ['pay rent Oct 1st', ['title' => 'Pay rent', 'dueDate' => '2026-10-01'], EXTRACTOR_NOW],
    'Vietnamese named month and year' => ['nộp bài ngày 26 tháng 9 năm 2027', ['title' => 'Nộp bài', 'dueDate' => '2027-09-26'], EXTRACTOR_NOW],
    'ISO date' => ['deploy 2026-11-02', ['title' => 'Deploy', 'dueDate' => '2026-11-02'], EXTRACTOR_NOW],
    'dotted date with year' => ['gửi hồ sơ 2.11.2026', ['title' => 'Gửi hồ sơ', 'dueDate' => '2026-11-02'], EXTRACTOR_NOW],
    'mùng day' => ['đóng học phí mùng 5', ['title' => 'Đóng học phí', 'dueDate' => '2026-11-05'], EXTRACTOR_NOW],
    'weeks from today' => ['renew passport in 2 weeks', ['title' => 'Renew passport', 'dueDate' => '2026-11-06'], EXTRACTOR_NOW],
    'months from today' => ['khám răng 3 tháng nữa', ['title' => 'Khám răng', 'dueDate' => '2027-01-23'], EXTRACTOR_NOW],
    'minutes from now' => ['gọi lại trong 30 phút', ['title' => 'Gọi lại', 'dueDate' => '2026-10-23', 'startTime' => '08:42'], EXTRACTOR_NOW],
    'hours from now past midnight' => ['take medicine in 2 hours', ['dueDate' => '2026-10-24', 'startTime' => '01:30'], '2026-10-23T23:30:00+07:00'],
    'nhắc tôi as a lead-in' => ['nhắc tôi gọi mẹ 2 tiếng nữa', ['title' => 'Gọi mẹ', 'startTime' => '10:12'], EXTRACTOR_NOW],
    'two dates keep the other one in the title' => ['study monday for quiz on friday 2pm', ['title' => 'Study monday for quiz', 'dueDate' => '2026-10-30', 'startTime' => '14:00'], EXTRACTOR_NOW],
    'unaccented Vietnamese with a time' => ['mai hop nhom 9h', ['lowConfidence' => true], EXTRACTOR_NOW],
    'English with a pronoun stays English' => ['call me tomorrow', ['lowConfidence' => false], EXTRACTOR_NOW],
]);

it('maps keywords only to projects the user has, in any case (NU-E34)', function () {
    expect(extractFields('go to gym', ['p' => 'personal'])->projectId)->toBe('p')
        ->and(extractFields('go to gym', ['s' => 'SQL Course'])->projectId)->toBeNull();
});

it('cuts long titles into notes (NU-E16)', function () {
    $fields = extractFields('read '.str_repeat('chapter ', 30));

    expect(mb_strlen($fields->title))->toBeLessThanOrEqual(config('notes.title_limit'))
        ->and($fields->notes)->not->toBeNull();
});

it('reads the title limit from config', function () {
    config(['notes.title_limit' => 10]);
    $fields = extractFields('read chapter seven today');

    expect([$fields->title, $fields->notes])->toBe(['Read', 'chapter seven']);
});

it('honors week start and note local time (T-NU-110)', function () {
    $lateFriday = '2026-10-23T22:00:00+07:00';

    expect(extractFields('read next week', [], $lateFriday, WeekStart::Sunday)->dueDate)->toBe('2026-10-25')
        ->and(extractFields('clean room end of the week', [], $lateFriday, WeekStart::Sunday)->dueDate)->toBe('2026-10-24')
        ->and(extractFields('read tonight', [], $lateFriday)->startTime)->toBeNull()
        ->and(extractFields('read tomorrow 9am', [], $lateFriday)->reminder->value)->toBe('15m');
});
