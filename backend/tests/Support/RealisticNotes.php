<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Services\Notes\NoteContext;
use DateTimeImmutable;

/**
 * The realistic note fixtures: one note per line, "\n" a line break inside a note, "#" a comment.
 * realistic-notes.txt mixes tasks, commands and skips; every item of realistic-tasks.txt is a task.
 */
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
        return self::read('realistic-notes.txt');
    }

    /** @return array<string, array{string}> notes whose every item must be read as a task */
    public static function tasks(): array
    {
        return self::read('realistic-tasks.txt');
    }

    /** @return array<string, array{string}> both fixtures */
    public static function all(): array
    {
        return [...self::dataset(), ...self::tasks()];
    }

    /** @return array<string, array{string}> */
    private static function read(string $file): array
    {
        $lines = file(__DIR__.'/../Fixtures/'.$file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $notes = array_filter($lines, fn (string $line): bool => ! str_starts_with($line, '#'));

        return array_combine($notes, array_map(fn (string $note): array => [str_replace('\n', "\n", $note)], $notes));
    }
}
