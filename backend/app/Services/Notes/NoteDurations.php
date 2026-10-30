<?php

declare(strict_types=1);

namespace App\Services\Notes;

/**
 * Relative amounts of time: "in 2 hours", "trong 30 phút", "3 ngày nữa", "after 2 weeks". The unit comes from
 * the "duration_unit:<unit>" family; a lead word (in, trong, sau …) or a trailing "nữa" marks it as relative.
 */
final class NoteDurations
{
    /** @return list<array{unit: string, amount: int, offset: int, length: int}> in text order */
    public function findAll(string $text): array
    {
        $found = [];
        foreach (NoteVocabulary::family('duration_unit') as $unit => $words) {
            $pattern = '~(?<![\p{L}\p{N}])(?:(?:'.NoteVocabulary::phrases('duration_prefix').')\s+(?<before>\d+)\s*(?:'.$words.')'
                .'|(?<after>\d+)\s*(?:'.$words.')\s+(?:'.NoteVocabulary::phrases('duration_suffix').'))(?![\p{L}\p{N}])~iu';
            preg_match_all($pattern, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
            foreach ($matches as $m) {
                $amount = ($m['before'][0] ?? '') !== '' ? $m['before'][0] : $m['after'][0];
                $found[] = ['unit' => (string) $unit, 'amount' => (int) $amount, 'offset' => $m[0][1], 'length' => strlen($m[0][0])];
            }
        }
        usort($found, fn (array $a, array $b): int => $a['offset'] <=> $b['offset']);

        return $found;
    }
}
