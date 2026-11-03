<?php

declare(strict_types=1);

namespace Tests\Support;

/** The note rules CSV read directly, for datasets that build before the app boots. */
final class NoteRules
{
    /** @return list<string> the values of one category, in file order */
    public static function values(string $category): array
    {
        return array_column(array_filter(self::rows(), fn (array $row): bool => $row[0] === $category), 1);
    }

    /** @return list<array{0: string, 1: string}> category and value of every rule */
    public static function rows(): array
    {
        $config = require __DIR__.'/../../config/notes.php';
        $lines = file($config['rules'], FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $rows = array_map(fn (string $line): array => str_getcsv($line, ',', '"', ''), array_slice($lines, 1));

        return array_values(array_map(
            fn (array $row): array => [trim((string) $row[0]), trim((string) $row[1])],
            array_filter($rows, fn (array $row): bool => count($row) === 2),
        ));
    }
}
