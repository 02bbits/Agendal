<?php

use App\Services\Notes\NoteSplitter;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

it('splits note boundaries and strips list markers (T-NU-01–07, T-NU-120)', function (string $text, array $expected) {
    expect((new NoteSplitter)->split($text, ['Portfolio']))->toBe($expected);
})->with([
    ["- [ ] buy milk\n1. call mum; read report. then email Lee", ['buy milk', 'call mum', 'read report', 'email Lee']],
    ['buy milk, eggs and bread', ['buy milk, eggs and bread']],
    ['buy ink, SQL quiz', ['buy ink', 'SQL quiz']],
    ['buy ink, urgent report', ['buy ink', 'urgent report']],
    ['buy ink, Portfolio mockup', ['buy ink', 'Portfolio mockup']],
    ['dentist, haircut', ['dentist', 'haircut']],
    ['visit athens then meet Dr. Lee at 9.30', ['visit athens', 'meet Dr. Lee at 9.30']],
    ['pay 1,000 for report.pdf', ['pay 1,000 for report.pdf']],
    ['mua sữa rồi gọi mẹ sau đó đọc sách', ['mua sữa', 'gọi mẹ', 'đọc sách']],
    ['bài tập xong rồi', ['bài tập xong rồi']],
    ["call mum\rcall dad", ['call mum', 'call dad']],
]);

it('rejects invisible, overlong and overfull notes', function (string $text, string $key) {
    try {
        (new NoteSplitter)->split($text);
        $this->fail('Expected a note validation error');
    } catch (ValidationException $error) {
        expect($error->errors())->toBe(['text' => [$key]]);
    }
})->with([
    [" . ; \u{200B}", 'note.empty'],
    [str_repeat('a', 5001), 'note.too_long'],
    [implode(';', array_fill(0, 31, 'call mum')), 'note.too_many_items'],
]);

it('normalizes decomposed accents and keeps newlines and tabs', function () {
    expect((new NoteSplitter)->normalize("  go\u{0323}i\tme\u{0323}\r\n\x01đọc "))->toBe("gọi\tmẹ\nđọc");
});
