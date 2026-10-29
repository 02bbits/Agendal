<?php

declare(strict_types=1);

namespace App\Services\Notes;

use Illuminate\Validation\ValidationException;
use Normalizer;
use RuntimeException;

final class NoteSplitter
{
    /** Text with a letter, digit or symbol (emoji) is visible; punctuation and spaces alone are not. */
    private const VISIBLE = '/[\p{L}\p{N}\p{So}]/u';

    public function normalize(string $text): string
    {
        $text = (string) preg_replace('/\r\n?|[\x{85}\x{2028}\x{2029}]/u', "\n", $text);
        $text = Normalizer::normalize($text, Normalizer::FORM_C) ?: $text;
        $text = (string) preg_replace('/[^\P{Cc}\t\n]|\p{Cf}/u', '', $text);
        $text = trim((string) preg_replace('/[^\S\t\n]/u', ' ', $text));
        if (preg_match(self::VISIBLE, $text) !== 1) {
            throw ValidationException::withMessages(['text' => ['note.empty']]);
        }
        if (mb_strlen($text) > (int) config('notes.max_length')) {
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
        $projects = array_values(array_filter(
            array_map(fn (string $project): string => trim(Normalizer::normalize($project, Normalizer::FORM_C) ?: $project), $projects),
            fn (string $project): bool => $project !== '',
        ));
        $checkboxes = [];
        foreach (NoteVocabulary::values('checkbox_bracket') as $pair) {
            $brackets = mb_str_split($pair);
            if (count($brackets) !== 2) {
                throw new RuntimeException('A checkbox_bracket rule needs one opening and one closing character: '.$pair);
            }
            $checkboxes[] = preg_quote($brackets[0], '~').'\s*(?:'.NoteVocabulary::phrases('checkbox_mark').')?\s*'.preg_quote($brackets[1], '~');
        }
        // "bullet" needs a space after it ("- buy", not "-5"); "tight_bullet" may touch the text ("•buy").
        $bullets = '~^\s*(?:(?:'.NoteVocabulary::phrases('bullet').')\s+|(?:'.NoteVocabulary::phrases('tight_bullet').')\s*|(?:\d+(?:'.NoteVocabulary::phrases('number_suffix').')|\p{L}(?:'.NoteVocabulary::phrases('letter_suffix').'))\s+|(?:'.implode('|', $checkboxes).')\s*)+~iu';
        $notAbbreviation = '';
        foreach (NoteVocabulary::values('abbreviation') as $abbreviation) {
            $notAbbreviation .= '(?<!\b'.preg_quote($abbreviation, '~').')';
        }
        // A sequence word glued to an email, file name or URL character ("then@x.com", "x.com/then") is not a split.
        $attachment = NoteVocabulary::phrases('word_attachment');
        $word = '(?<![\p{L}\p{N}_])(?<!'.$attachment.')';
        $delimiter = '~(*UCP)(?:'.NoteVocabulary::phrases('separator').')|'.$word.'(?:'.NoteVocabulary::phrases('conjunction').')(?![\p{L}\p{N}_])(?!(?:'.$attachment.')[\p{L}\p{N}])|'.$word.'(?:'.NoteVocabulary::phrases('following_conjunction').')\s+(?=\S)|'.$notAbbreviation.'(?:'.NoteVocabulary::phrases('full_stop').')+(?=\s|$)~iu';
        $commas = NoteVocabulary::phrases('comma');
        $joiner = NoteVocabulary::phrases('list_joiner');
        $items = [];
        foreach (explode("\n", $text) as $line) {
            $line = (string) preg_replace($bullets, '', $line);
            foreach (preg_split($delimiter, $line) ?: [] as $chunk) {
                $current = '';
                $comma = '';
                // A comma between digits ("1,000") is part of the number.
                foreach (preg_split('~((?<!\d)(?:'.$commas.')|(?:'.$commas.')(?!\d))~u', $chunk, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [] as $index => $fragment) {
                    if ($index % 2 === 1) {
                        $comma = $fragment;

                        continue;
                    }
                    $fragment = trim($fragment);
                    if (preg_match(self::VISIBLE, $fragment) !== 1) {
                        continue;
                    }
                    $joins = $current !== '' && ($this->onlyModifiers($fragment)
                        || (NoteVocabulary::startsWithVerb($this->withoutLeadIn($current)) && ! $this->startsNewTask($fragment, $projects)));
                    if ($joins) {
                        $current .= $comma.' '.$fragment;
                    } else {
                        $items[] = $current;
                        $current = $fragment;
                    }
                }
                $items[] = $current;
            }
        }
        // Joiners left at an item edge ("buy milk and then …", ", and email boss") belong to no item.
        // A leading filler ("rồi thì gọi mẹ" leaves "thì gọi mẹ") is dropped only at the start.
        $leading = $joiner.'|'.NoteVocabulary::phrases('leading_filler');
        $items = array_map(fn (string $item): string => trim((string) preg_replace('~^(?:(?:'.$leading.')(?:\s+|$))+|(?:(?:^|\s+)(?:'.$joiner.'))+$~iu', '', $item)), $items);
        $items = array_values(array_filter($items, fn (string $item): bool => preg_match(self::VISIBLE, $item) === 1));
        if ($items === []) {
            throw ValidationException::withMessages(['text' => ['note.empty']]);
        }
        if (count($items) > (int) config('notes.max_items')) {
            throw ValidationException::withMessages(['text' => ['note.too_many_items']]);
        }

        return $items;
    }

    private function withoutLeadIn(string $text): string
    {
        $leads = NoteVocabulary::phrases('lead_in').'|'.NoteVocabulary::phrases('list_joiner').'|'.NoteVocabulary::phrases('leading_filler');

        return (string) preg_replace('~^(?:(?:'.$leads.')\s+)+~iu', '', $text);
    }

    /**
     * The fragment starts a task of its own (NU §2.2): it opens with a date, time, priority or repeat word
     * ("26 Oct meeting", "mai gọi mẹ"), a verb, a command or a skip prefix, or it names a project, one of the
     * user's project keywords (NU-E34) or a task ("quiz"). Date and time words that close a fragment describe
     * the whole list instead ("mua sữa, trứng sáng mai" is one task for tomorrow morning).
     *
     * @param  list<string>  $projects
     */
    private function startsNewTask(string $text, array $projects): bool
    {
        $text = $this->withoutLeadIn($text);
        if (preg_match('~^(?:'.$this->modifier().')~iu', $text) === 1) {
            return true;
        }
        $commands = implode('|', array_map(NoteVocabulary::phrases(...), ['complete_command', 'move_command', 'delete_command', 'skip_prefix']));
        if (NoteVocabulary::startsWithVerb($text)
            || preg_match('~^(?:'.$commands.')(?![\p{L}\p{N}_])~iu', $text) === 1
            || preg_match('~(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('complete_suffix').')$~iu', $text) === 1) {
            return true;
        }
        $names = NoteVocabulary::phrases('priority_high_content');
        $owned = array_map(mb_strtolower(...), $projects);
        foreach ($projects as $project) {
            $names .= '|'.preg_quote($project, '~');
        }
        foreach (NoteVocabulary::projectKeywords() as $project => $keywords) {
            if (in_array(mb_strtolower(trim(Normalizer::normalize($project, Normalizer::FORM_C) ?: $project)), $owned, true)) {
                $names .= '|'.$keywords;
            }
        }

        return preg_match(NoteVocabulary::pattern($names), $text) === 1;
    }

    /**
     * "tomorrow 9am", "không gấp": a fragment of only date, time, priority and repeat words describes the item
     * before it, so it joins that item whatever it starts with.
     */
    private function onlyModifiers(string $fragment): bool
    {
        $rest = (string) preg_replace('~'.$this->modifier().'~iu', ' ', $this->withoutLeadIn($fragment));

        return preg_match(self::VISIBLE, $rest) !== 1;
    }

    /**
     * A date, time, priority or repeat word, possibly after a day number (26 Oct), a date or clock time (26/10,
     * 9:30), a number with a time unit (9am, 9h30, 3 days), or an hour after "at" (at 14).
     */
    private function modifier(): string
    {
        return '(?<![\p{L}\p{N}_])(?:\d{1,2}\s+)?(?:'.NoteVocabulary::modifiers().')(?![\p{L}\p{N}_])'
            .'|\d+(?:(?:'.NoteVocabulary::phrases('time_separator').')\d+)+'
            .'|\d+\s*(?:'.NoteVocabulary::phrases('time_unit').')(?![\p{L}_])'
            .'|(?<![\p{L}\p{N}_])(?:'.NoteVocabulary::phrases('time_prefix').')\s+\d{1,2}(?!\d)';
    }
}
