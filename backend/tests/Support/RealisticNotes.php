<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Notes\NoteContext;
use DateTimeImmutable;

/** tests/Fixtures/realistic-notes.txt: one note per line, "\n" a line break inside a note, "#" a comment. */
final class RealisticNotes
{
    /** Friday 23 Oct 2026, 08:12 in Ho Chi Minh City, with the projects the notes name. */
    public static function context(): NoteContext
    {
        return new NoteContext(new DateTimeImmutable('2026-10-23T08:12:00+07:00'), 'Asia/Ho_Chi_Minh', ['hci' => 'HCI', 'sql' => 'SQL Course', 'web' => 'Adv Web', 'personal' => 'Personal']);
    }

    /** @return array<string, array{string}> the line as the dataset name, the note as the value */
    public static function dataset(): array
    {
        $lines = file(__DIR__.'/../Fixtures/realistic-notes.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $notes = array_filter($lines, fn (string $line): bool => ! str_starts_with($line, '#'));

        return array_combine($notes, array_map(fn (string $note): array => [str_replace('\n', "\n", $note)], $notes));
    }
}
