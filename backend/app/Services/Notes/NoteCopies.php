<?php

declare(strict_types=1);

namespace App\Services\Notes;

use InvalidArgumentException;

/** Independent copies of one create entry, named and bounded the same way for rules and model proposals. */
final class NoteCopies
{
    /**
     * @param  array<string, mixed>  $entry
     * @return list<array<string, mixed>>
     */
    public static function expand(array $entry, int $copies): array
    {
        if ($copies < 1 || $copies > (int) config('notes.max_items')) {
            throw new InvalidArgumentException('Invalid note copy count.');
        }
        if ($copies === 1) {
            return [$entry];
        }
        $entries = [];
        $title = (string) $entry['title'];
        foreach (range(1, $copies) as $copy) {
            $suffix = ' ('.$copy.'/'.$copies.')';
            $limit = (int) config('notes.title_limit') - mb_strlen($suffix);
            $item = [...$entry, 'ref' => $copy === 1 ? $entry['ref'] : $entry['ref'].'-'.$copy,
                'title' => mb_substr($title, 0, $limit).$suffix];
            $overflow = mb_substr($title, $limit);
            if ($overflow !== '') {
                $item['notes'] = trim($overflow.' '.($entry['notes'] ?? ''));
            }
            $entries[] = $item;
        }

        return $entries;
    }
}
