<?php

declare(strict_types=1);

namespace App\Services\Search;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SearchMatcher
{
    public const QUERY_MAX = 100;

    private const TONE_PAIRS = [
        'òa' => 'oà', 'oà' => 'òa',
        'óa' => 'oá', 'oá' => 'óa',
        'ỏa' => 'oả', 'oả' => 'ỏa',
        'õa' => 'oã', 'oã' => 'õa',
        'ọa' => 'oạ', 'oạ' => 'ọa',
        'òe' => 'oè', 'oè' => 'òe',
        'óe' => 'oé', 'oé' => 'óe',
        'ỏe' => 'oẻ', 'oẻ' => 'ỏe',
        'õe' => 'oẽ', 'oẽ' => 'õe',
        'ọe' => 'oẹ', 'oẹ' => 'ọe',
        'ùy' => 'uỳ', 'uỳ' => 'ùy',
        'úy' => 'uý', 'uý' => 'úy',
        'ủy' => 'uỷ', 'uỷ' => 'ủy',
        'ũy' => 'uỹ', 'uỹ' => 'ũy',
        'ụy' => 'uỵ', 'uỵ' => 'ụy',
    ];

    /**
     * @return list<string>
     */
    public function words(string $raw): array
    {
        if (trim($raw) === '') {
            return [];
        }

        $input = mb_substr($raw, 0, self::QUERY_MAX);
        /** @var object{q: string|null}|null $row */
        $row = DB::selectOne('select normalize(?, NFC) as q', [$input]);
        $nfc = (string) ($row->q ?? '');
        $lower = mb_strtolower($nfc);

        /** @var list<string> $parts */
        $parts = preg_split('/\s+/u', $lower, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_unique($parts));
    }

    /**
     * @param  literal-string  $column
     * @return array{0: literal-string, 1: list<string>}
     */
    public function clause(string $word, string $column): array
    {
        $raw = "lower(normalize({$column}, NFC))";
        $folded = "immutable_unaccent({$raw})";
        $tokens = fn (string $e): string => "(' ' || regexp_replace({$e}, '[[:space:][:punct:]]+', ' ', 'g') || ' ')";
        $escape = fn (string $w): string => str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $w);

        if (! $this->isAccented($word)) {
            $escaped = $escape($word);
            if ($this->isShort($word)) {
                /** @var literal-string $sql */
                $sql = "{$tokens($folded)} LIKE ? ESCAPE '!'";

                return [$sql, ['% '.$escaped.'%']];
            }

            /** @var literal-string $sql */
            $sql = "{$folded} LIKE ? ESCAPE '!'";

            return [$sql, ['%'.$escaped.'%']];
        }

        $isShort = $this->isShort($word);
        /** @var list<literal-string> $subClauses */
        $subClauses = [];
        $bindings = [];

        foreach ($this->toneForms($word) as $form) {
            $escapedForm = $escape($form);
            if ($isShort) {
                /** @var literal-string $clause */
                $clause = "{$tokens($raw)} LIKE ? ESCAPE '!'";
                $subClauses[] = $clause;
                $bindings[] = '% '.$escapedForm.'%';
            } else {
                /** @var literal-string $clause */
                $clause = "{$raw} LIKE ? ESCAPE '!'";
                $subClauses[] = $clause;
                $bindings[] = '%'.$escapedForm.'%';
            }
        }

        $foldedWord = $this->fold($word);
        if (mb_strlen($foldedWord) >= 2) {
            $escapedFolded = $escape($foldedWord);
            if ($isShort) {
                /** @var literal-string $clause */
                $clause = "{$tokens($raw)} LIKE ? ESCAPE '!'";
                $subClauses[] = $clause;
                $bindings[] = '% '.$escapedFolded.' %';
            } else {
                /** @var literal-string $clause */
                $clause = "{$raw} LIKE ? ESCAPE '!'";
                $subClauses[] = $clause;
                $bindings[] = '%'.$escapedFolded.'%';
            }
        }

        /** @var literal-string&non-falsy-string $sql */
        $sql = '('.implode(' OR ', $subClauses).')';

        return [$sql, $bindings];
    }

    private function fold(string $word): string
    {
        return mb_strtolower(Str::ascii($word));
    }

    private function isAccented(string $word): bool
    {
        return preg_match('/[\p{Latin}\p{M}]/u', $word) === 1
            && preg_match('/^[\p{Latin}\p{M}\p{N}\p{P}\p{S}]+$/u', $word) === 1
            && $word !== $this->fold($word);
    }

    private function isShort(string $word): bool
    {
        return mb_strlen($this->fold($word)) <= 2
            && preg_match('/^[\p{L}\p{M}\p{N}]+$/u', $word) === 1;
    }

    /**
     * @return list<string>
     */
    private function toneForms(string $word): array
    {
        $swapped = strtr($word, self::TONE_PAIRS);

        return $swapped !== $word ? [$word, $swapped] : [$word];
    }
}
