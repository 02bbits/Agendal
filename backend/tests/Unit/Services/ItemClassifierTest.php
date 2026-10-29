<?php

use App\Services\Notes\ItemClassifier;

it('classifies prefixes, filler and commands (T-NU-30–33)', function (string $text, string $type, ?string $action) {
    expect((new ItemClassifier)->classify($text))->toBe(['type' => $type, 'action' => $action]);
})->with([
    ['idea: read a book', 'skip', null], ['ghi chú: phòng đóng cửa', 'skip', null],
    ['cảm ơn!', 'skip', null], ['ok thanks', 'skip', null],
    ['remember that the office is closed', 'skip', null], ['remember to call mum', 'task', null],
    ['đã xong bài tập', 'command', 'complete'], ['bài tập xong rồi', 'command', 'complete'],
    ['xóa bài tập', 'command', 'delete'], ['dời bài tập sang mai', 'command', 'reschedule'],
    ['move house', 'task', null], ['move house to', 'task', null],
]);
