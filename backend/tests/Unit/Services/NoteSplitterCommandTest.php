<?php

use App\Console\Commands\SplitNoteCommand;
use Tests\TestCase;

uses(TestCase::class);

it('splits an arbitrary note and accepts known project names', function () {
    $this->artisan('notes:split', ['text' => 'buy ink, Research (2026) outline', '--project' => ['Research (2026)']])
        ->expectsOutput(json_encode(['buy ink', 'Research (2026) outline'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))
        ->assertSuccessful();
});

it('keeps generated scenarios out of the application command', function () {
    $command = app(SplitNoteCommand::class);
    expect($command->getDefinition()->hasOption('scenarios'))->toBeFalse()
        ->and($command->getDefinition()->hasOption('filter'))->toBeFalse();
});

it('returns input errors without invoking a test runner', function () {
    $this->artisan('notes:split')->assertFailed();
    $this->artisan('notes:split', ['text' => ' . ; '])->expectsOutputToContain('note.empty')->assertFailed();
    $this->artisan('notes:split', ['--file' => '/missing-note-file.txt'])->assertFailed();
    $this->artisan('notes:split', ['text' => 'call mum', '--file' => '/unused.txt'])->assertFailed();
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
