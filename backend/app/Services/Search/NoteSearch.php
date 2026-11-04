<?php

declare(strict_types=1);

namespace App\Services\Search;

use App\Models\Note;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Support\Str;

final class NoteSearch
{
    public const LIMIT = 20;

    public const SNIPPET = 120;

    /**
     * @return array{items: list<array{id: string, title: string, snippet: string, status: string, written_at: string|null}>}
     */
    public function search(int $userId, string $rawQuery): array
    {
        $q = trim(mb_substr($rawQuery, 0, 100));
        /** @var list<string> $words */
        $words = $q !== '' ? (preg_split('/\s+/', $q, -1, PREG_SPLIT_NO_EMPTY) ?: []) : [];
        if ($words === []) {
            return ['items' => []];
        }

        $query = Note::query()
            ->where('user_id', $userId);

        $patterns = array_map(
            fn (string $w): string => '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $w).'%',
            $words
        );

        foreach ($patterns as $pattern) {
            $query->whereRaw(
                "immutable_unaccent(lower(coalesce(name, '') || ' ' || text)) ILIKE immutable_unaccent(lower(?)) ESCAPE '!'",
                [$pattern]
            );
        }

        $notes = $query
            ->select(['id', 'name', 'text', 'status', 'written_at'])
            ->orderByDesc('written_at')
            ->orderBy('id')
            ->limit(self::LIMIT)
            ->get();

        $items = [];
        foreach ($notes as $note) {
            $title = (is_string($note->name) && $note->name !== '')
                ? $note->name
                : mb_substr((string) $note->text, 0, 35);

            $items[] = [
                'id' => (string) $note->id,
                'title' => $title,
                'snippet' => $this->snippet((string) $note->text, $words),
                'status' => (string) $note->status,
                'written_at' => $this->formatIso($note->written_at),
            ];
        }

        return ['items' => $items];
    }

    /**
     * @param  list<string>  $words
     */
    private function snippet(string $text, array $words): string
    {
        $chars = mb_str_split($text);
        $totalChars = count($chars);
        if ($totalChars === 0) {
            return '';
        }

        $normalized = '';
        $source = [];
        foreach ($chars as $i => $ch) {
            $normCh = ord($ch) < 128 ? strtolower($ch) : mb_strtolower(Str::ascii($ch));
            $offset = strlen($normalized);
            $len = strlen($normCh);
            for ($b = 0; $b < $len; $b++) {
                $source[$offset + $b] = $i;
            }
            $normalized .= $normCh;
        }

        $firstAt = null;
        foreach ($words as $word) {
            $normWord = '';
            foreach (mb_str_split($word) as $ch) {
                $normWord .= ord($ch) < 128 ? strtolower($ch) : mb_strtolower(Str::ascii($ch));
            }
            if ($normWord === '') {
                continue;
            }
            $pos = strpos($normalized, $normWord);
            if ($pos !== false && ($firstAt === null || $pos < $firstAt)) {
                $firstAt = $pos;
            }
        }

        if ($firstAt !== null && isset($source[$firstAt])) {
            $matchCharIndex = $source[$firstAt];
            $start = max(0, $matchCharIndex - 40);
        } else {
            $start = 0;
        }

        $slice = array_slice($chars, $start, self::SNIPPET);
        $snippet = implode('', $slice);

        if ($start > 0) {
            $snippet = '…'.$snippet;
        }
        if ($start + self::SNIPPET < $totalChars) {
            $snippet .= '…';
        }

        return $snippet;
    }

    private function formatIso(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value->toIso8601String();
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        return (new \DateTimeImmutable((string) $value))->format(DateTimeInterface::ATOM);
    }
}
