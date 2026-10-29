<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Validation\ValidationException;
use Normalizer;

final class NoteSplitter
{
    public function normalize(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = Normalizer::normalize($text, Normalizer::FORM_C) ?: $text;
        $text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\p{Cf}]/u', '', $text));
        if (preg_match('/[\p{L}\p{N}\p{So}]/u', $text) !== 1) {
            throw ValidationException::withMessages(['text' => ['note.empty']]);
        }
        if (mb_strlen($text) > 5000) {
            throw ValidationException::withMessages(['text' => ['note.too_long']]);
        }

        return $text;
    }

    /**
     * @param  list<string>  $projects
     * @return list<string>
     */
    public function split(string $text, array $projects = []): array
    {
        $text = $this->normalize($text);
        $lines = preg_split('/\n/u', $text) ?: [];
        $items = [];
        foreach ($lines as $line) {
            $line = (string) preg_replace('/^\s*(?:(?:[-*•–—]|\d+[.)]|[a-z][)])\s+|\[[ xX]\]\s*)+/iu', '', $line);
            $notAbbreviation = '';
            foreach (['Dr', 'Prof', 'Mr', 'Mrs', 'Ms', 'St', 'No', 'vs', 'etc', 'e.g', 'i.e'] as $abbreviation) {
                $notAbbreviation .= '(?<!'.preg_quote($abbreviation, '~').')';
            }
            $delimiter = '~;|(?<![\p{L}\p{N}_])then(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:rồi|sau đó)\s+(?=\S)|'.$notAbbreviation.'\.(?=\s|$)~iu';
            foreach (preg_split($delimiter, $line) ?: [] as $chunk) {
                $current = '';
                foreach (preg_split('/(?<!\d),|,(?!\d)/u', $chunk) ?: [] as $fragment) {
                    $fragment = trim($fragment);
                    if ($fragment === '') {
                        continue;
                    }
                    if ($current !== '' && NoteVocabulary::startsWithVerb($current) && ! $this->hasSignal($fragment, $projects)) {
                        $current .= ', '.$fragment;
                    } else {
                        if ($current !== '') {
                            $items[] = $current;
                        }
                        $current = $fragment;
                    }
                }
                if ($current !== '') {
                    $items[] = $current;
                }
            }
        }
        if (count($items) > 30) {
            throw ValidationException::withMessages(['text' => ['note.too_many_items']]);
        }

        return $items;
    }

    /** @param list<string> $projects */
    private function hasSignal(string $text, array $projects): bool
    {
        $signals = NoteVocabulary::COMPLETE.'|'.NoteVocabulary::MOVE.'|'.NoteVocabulary::DELETE.'|'.NoteVocabulary::SKIP_PREFIXES;
        if (NoteVocabulary::startsWithVerb($text) || preg_match('~^(?:'.$signals.')(?![\p{L}\p{N}_])~iu', $text)) {
            return true;
        }
        $signals = 'today|tonight|tomorrow|tmr|day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|morning|noon|evening|next week|end of the week|end of the month|every|daily|weekly|monthly|urgent|asap|important|priority|deadline|exam|quiz|submit|whenever|someday|maybe|hôm nay|tối nay|mai|mốt|thứ|chủ nhật|cn|t[2-7]|sáng|trưa|chiều|tối|tuần sau|tuần tới|cuối tuần|cuối tháng|mỗi|hằng|hàng|gấp|khẩn|quan trọng|ưu tiên|hạn chót|thi|kiểm tra|nộp|khi nào rảnh|sql|database|er diagram|hci|web|gym|mum|groceries';
        foreach ($projects as $project) {
            $signals .= '|'.preg_quote($project, '~');
        }

        return preg_match(NoteVocabulary::pattern($signals), $text) === 1
            || preg_match('/\d{1,4}(?:[\/:.h]\d*|\s*(?:am|pm|giờ|days|ngày))/iu', $text) === 1;
    }
}
