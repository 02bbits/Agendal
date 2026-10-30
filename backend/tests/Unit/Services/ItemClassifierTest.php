<?php

use App\Services\Notes\ItemClassifier;
use App\Services\Notes\NoteContext;
use Tests\Support\NoteClassifierScenarios;
use Tests\TestCase;

uses(TestCase::class);

/** "kind" or "kind/action", as the datasets write it. */
function classified(string $text): string
{
    $classifier = app(ItemClassifier::class);
    $result = $classifier->classify($text, new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh'));

    return $result->kind->value.($result->action === null ? '' : '/'.$result->action->value);
}

it('classifies prefixes, filler and commands (T-NU-30–33)', function (string $text, string $expected) {
    expect(classified($text))->toBe($expected);
})->with([
    ['idea: read a book', 'skip'], ['ghi chú: phòng đóng cửa', 'skip'],
    ['cảm ơn!', 'skip'], ['ok thanks', 'skip'],
    ['remember that the office is closed', 'skip'], ['remember to call mum', 'task'],
    ['đã xong bài tập', 'command/complete'], ['bài tập xong rồi', 'command/complete'],
    ['xóa bài tập', 'command/delete'], ['dời bài tập sang mai', 'command/reschedule'],
    ['move house', 'task'], ['move house to', 'task'],
    'NU-E32 only a date and time' => ['tomorrow 9am', 'skip'],
    'NU-E32 only a priority' => ['không gấp', 'skip'],
]);

it('reads real notes the way a person means them', function (string $text, string $expected) {
    expect(classified($text))->toBe($expected);
})->with([
    'plural prefix' => ['ideas: dark mode', 'skip'],
    'short filler' => ['thx', 'skip'],
    'laughing' => ['haha', 'skip'],
    'Vietnamese filler' => ['dạ vâng', 'skip'],
    'symbols alone' => ['👍', 'skip'],
    'heading' => ['Tuần này:', 'skip'],
    'English heading' => ['Shopping list:', 'skip'],
    'a task ending with a colon' => ['call mum:', 'task'],
    'move to a place is a task' => ['move the boxes to the garage', 'task'],
    'push to a place is a task' => ['push code to github', 'task'],
    'move to a time' => ['move meeting to 3pm', 'command/reschedule'],
    'chuyển sang a place is a task' => ['chuyển đồ sang phòng mới', 'task'],
    'phrasal drop off' => ['drop off the package', 'task'],
    'bỏ rác is no delete' => ['bỏ rác tối nay', 'task'],
    'noun then done' => ['homework done', 'command/complete'],
    'noun then xong' => ['bài tập xong', 'command/complete'],
    'verb then done' => ['get it done', 'task'],
    'done with punctuation' => ['report is done!', 'command/complete'],
]);

dataset('classifier rules', function (): array {
    // Datasets build before the app boots, so read the config file directly.
    $config = require __DIR__.'/../../../config/notes.php';

    return NoteClassifierScenarios::generate($config['rules']);
});

it('reads every classifier rule in the shared rules CSV', function (string $text, string $expected) {
    expect(classified($text))->toBe($expected);
})->with('classifier rules');
