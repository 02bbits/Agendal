<?php

use Tests\TestCase;

uses(TestCase::class);

it('splits an arbitrary note and accepts known project names', function () {
    $this->artisan('notes:split', ['text' => 'buy ink, Research (2026) outline', '--project' => ['Research (2026)']])
        ->expectsOutput(json_encode(['buy ink', 'Research (2026) outline'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))
        ->assertSuccessful();
});

it('runs scenarios through the real application command', function () {
    $this->artisan('notes:split', ['--scenarios' => true, '--filter' => 'numeric 9:30'])
        ->expectsOutputToContain('PASS numeric 9:30')
        ->expectsOutputToContain('1 scenarios; 0 failed')
        ->assertSuccessful();
});

it('fails when no scenario matches the requested name', function () {
    $this->artisan('notes:split', ['--scenarios' => true, '--filter' => 'missing-category'])
        ->expectsOutputToContain('0 scenarios; 0 failed')
        ->assertFailed();
});

it('returns input errors without invoking a test runner', function () {
    $this->artisan('notes:split')->assertFailed();
    $this->artisan('notes:split', ['text' => ' . ; '])->expectsOutputToContain('note.empty')->assertFailed();
    $this->artisan('notes:split', ['--file' => '/missing-note-file.txt'])->assertFailed();
    $this->artisan('notes:split', ['text' => 'call mum', '--scenarios' => true])->assertFailed();
});

it('reads a UTF-8 note from a file', function () {
    $path = tempnam(sys_get_temp_dir(), 'note-split-');
    file_put_contents($path, "mua sữa\nđọc sách");
    try {
        $this->artisan('notes:split', ['--file' => $path])->expectsOutput(json_encode(['mua sữa', 'đọc sách'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))->assertSuccessful();
    } finally {
        unlink($path);
    }
});
